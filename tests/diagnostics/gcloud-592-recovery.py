"""Real SDK592 Run/update path, entirely fake API clients; all sockets denied."""
import copy
import hashlib
import json
from pathlib import Path
import socket
import sys
import types
import zipfile

sdk = Path(sys.argv[1]).resolve()
plan = json.loads(Path(sys.argv[2]).read_text())
snapshot = json.loads(Path(sys.argv[3]).read_text())
assert (sdk / "VERSION").read_text().strip() == "592.0.0"
sys.path[:0] = [str(sdk / "lib"), str(sdk / "lib/third_party")]
network_attempts = []


def forbidden(*args, **kwargs):
    network_attempts.append("blocked")
    raise AssertionError("Network forbidden in SDK recovery proof")


socket.socket.connect = forbidden
socket.socket.connect_ex = forbidden
socket.create_connection = forbidden
socket.getaddrinfo = forbidden

from googlecloudsdk import gcloud_main
from googlecloudsdk.command_lib.functions import source_util
from googlecloudsdk.command_lib.functions.v2.deploy import command
from googlecloudsdk.generated_clients.apis.cloudfunctions.v2 import cloudfunctions_v2_messages as messages
from apitools.base.py import encoding

existing = encoding.DictToMessage(snapshot["fn"], messages.Function)
active = copy.deepcopy(existing)
active.state = messages.Function.StateValueValuesEnum.ACTIVE
events, patches, uploads = [], [], []


class FakeStorage:
    def CopyFileToGCS(self, filename, destination):
        with zipfile.ZipFile(filename) as archive:
            actual = {name: hashlib.sha256(archive.read(name)).hexdigest()
                      for name in archive.namelist() if not name.endswith("/")}
        assert actual == plan["hashes"]
        events.append("synthetic-upload")
        uploads.append({"bucket": destination.bucket, "files": sorted(actual)})


def get_function(name):
    assert name == snapshot["fn"]["name"]
    events.append("get-function")
    return active if patches else existing


def patch(request):
    assert request.name == snapshot["fn"]["name"]
    events.append("patch-function")
    patches.append(encoding.MessageToDict(request))
    return messages.Operation(name="synthetic-update")


def create(*args, **kwargs):
    raise AssertionError("Existing FAILED function must never enter Create in this scenario")


def invoker(function, **kwargs):
    assert patches and str(function.state) == "ACTIVE"
    assert kwargs == {"add_binding": True, "member": "allUsers"}
    events.append("post-update-invoker")


raw_client = types.SimpleNamespace(MESSAGES_MODULE=messages,
    projects_locations_functions=types.SimpleNamespace(Patch=patch, Create=create))
fake_client = types.SimpleNamespace(client=raw_client, messages=messages,
    GetFunction=get_function, ListRuntimes=lambda region: types.SimpleNamespace(
        runtimes=[types.SimpleNamespace(name="nodejs22", environment="GEN_2", warnings=[])]))
command.client_v2.FunctionsClient = lambda **kwargs: fake_client
command.source_util.storage_api.StorageClient = FakeStorage
command.api_enablement.PromptToEnableApiIfDisabled = lambda api: events.append("checked-api:" + api)
command.service_account_util.ValidateDefaultBuildServiceAccountAndPromptWarning = lambda project, region, builder: None
command.api_util.WaitForOperation = lambda *args: events.append("synthetic-wait")
command.run_util.AddOrRemoveInvokerBinding = invoker
# No replacement of command.Run or _UpdateAndWait: execute the real branching,
# request construction and Patch call. Nothing can reach real APIs or IAM.
cli = gcloud_main.CreateCLI([])
cli.Execute(plan["args"] + ["--format=none"], call_arg_complete=False)
assert len(patches) == 1 and len(uploads) == 1 and not network_attempts
assert events.index("patch-function") < events.index("post-update-invoker")
request = patches[0]
assert "build_config.source" in request["updateMask"]
assert request["function"]["buildConfig"]["serviceAccount"] == existing.buildConfig.serviceAccount
print(json.dumps({"sdk": "592.0.0", "mode": "OFFLINE_REAL_RUN_FAILED_UPDATE_PATH",
                  "networkAttempts": len(network_attempts), "patches": len(patches),
                  "events": events, "request": request, "upload": uploads[0]}, sort_keys=True))
