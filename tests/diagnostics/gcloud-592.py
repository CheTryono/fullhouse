"""Offline proof using an installed official SDK. NEVER calls the deploy Run body."""
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import types
import zipfile

sdk = Path(sys.argv[1]).resolve()
plan = json.loads(Path(sys.argv[2]).read_text())
assert (sdk / "VERSION").read_text().strip() == "592.0.0"
sys.path[:0] = [str(sdk / "lib"), str(sdk / "lib/third_party")]
network_attempts = []


def forbidden(*args, **kwargs):
    network_attempts.append("blocked")
    raise AssertionError("Network is forbidden in the offline SDK proof")


socket.socket.connect = forbidden
socket.socket.connect_ex = forbidden
socket.create_connection = forbidden
socket.getaddrinfo = forbidden

from googlecloudsdk import gcloud_main
from googlecloudsdk.command_lib.functions import source_util
from googlecloudsdk.command_lib.functions.v2.deploy import command
from googlecloudsdk.generated_clients.apis.cloudfunctions.v2 import cloudfunctions_v2_messages as messages
from apitools.base.py import encoding

uploads = []
captured = []


class FakeStorage:
    def CopyFileToGCS(self, filename, destination):
        with zipfile.ZipFile(filename) as archive:
            actual = {name: hashlib.sha256(archive.read(name)).hexdigest()
                      for name in archive.namelist() if not name.endswith("/")}
        assert actual == plan["hashes"], ("Source ZIP differs", sorted(actual), sorted(plan["hashes"]), [key for key in actual if actual[key] != plan["hashes"].get(key)])
        uploads.append({"bucket": destination.bucket, "object": destination.name,
                        "zipFiles": sorted(actual)})


def capture(args, track):
    # Replaces the complete mutating command body, including API enablement,
    # Get/Create/UpdateFunction, IAM changes and polling. Only pure helpers run.
    client = types.SimpleNamespace(MESSAGES_MODULE=messages)
    ref = args.CONCEPTS.name.Parse()
    config, _ = command._GetBuildConfig(args, client, ref, None)
    service, _ = command._GetServiceConfig(args, messages, None)
    trigger, _ = command._GetEventTrigger(args, messages, None)
    labels, _ = command._GetLabels(args, messages, None)
    assert trigger is None
    fn = messages.Function(name=ref.RelativeName(), buildConfig=config,
                           serviceConfig=service, labels=labels)
    command._SetDockerRepositoryConfig(args, fn, None)
    captured.append(encoding.MessageToDict(fn))
    assert args.allow_unauthenticated is True
    return None


source_util.storage_api.StorageClient = FakeStorage
command.Run = capture
cli = gcloud_main.CreateCLI([])
cli.Execute(plan["args"] + ["--format=none"], call_arg_complete=False)
assert len(captured) == 1 and len(uploads) == 1 and not network_attempts
print(json.dumps({"sdk": "592.0.0", "mode": "OFFLINE_PARSER_AND_HELPERS_ONLY",
                  "networkAttempts": len(network_attempts), "upload": uploads[0],
                  "request": captured[0]}, sort_keys=True))
