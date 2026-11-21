export function authError(error: unknown): string {
  const code = (error as {code?:string})?.code || '';
  const messages: Record<string,string> = {
    'auth/invalid-credential':'El correo o la contraseña no son correctos.',
    'auth/wrong-password':'El correo o la contraseña no son correctos.',
    'auth/user-not-found':'El correo o la contraseña no son correctos.',
    'auth/invalid-email':'Escribe un correo electrónico válido.',
    'auth/email-already-in-use':'No pudimos crear la cuenta. Prueba iniciar sesión o recuperar el acceso.',
    'auth/weak-password':'La contraseña no cumple los requisitos del proyecto. Usa al menos ocho caracteres.',
    'auth/password-does-not-meet-requirements':'La contraseña no cumple la política de seguridad del proyecto.',
    'auth/too-many-requests':'Hubo demasiados intentos. Espera un momento antes de volver a intentar.',
    'auth/network-request-failed':'No pudimos conectar. Revisa tu conexión y vuelve a intentar.',
    'auth/user-disabled':'No se pudo abrir esta cuenta. Contacta con soporte.',
    'auth/expired-action-code':'El enlace venció. Solicita uno nuevo.',
    'auth/invalid-action-code':'El enlace no es válido o ya se utilizó. Solicita uno nuevo.',
    'auth/operation-not-allowed':'El acceso por correo todavía no está habilitado en Firebase.',
    'auth/unauthorized-continue-uri':'El dominio de retorno no está autorizado en Firebase.',
    'auth/invalid-api-key':'La configuración de Firebase no es válida.',
    'auth/web-storage-unsupported':'El navegador bloquea el almacenamiento de la sesión. Permítelo y vuelve a intentar.'
  };
  return messages[code] || 'No pudimos completar la operación. Vuelve a intentar; no hemos confirmado que haya terminado.';
}
