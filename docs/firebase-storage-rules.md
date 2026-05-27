# Reglas sugeridas para Firebase Storage

Estas reglas son una base para permitir que usuarios autenticados suban imagenes de eventos a su propia carpeta. Revisalas antes de aplicarlas en Firebase Console.

```txt
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /event-images/{userId}/{eventId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|jpg|png|webp)');
    }
  }
}
```

Si en una fase posterior se agregan permisos por evento o roles de administrador, conviene validar contra documentos de Firestore antes de permitir escritura global.
