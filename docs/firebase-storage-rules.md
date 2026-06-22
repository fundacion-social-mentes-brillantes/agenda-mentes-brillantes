# Reglas de Firebase Storage

Las reglas oficiales están en el archivo [`storage.rules`](../storage.rules) en la raíz del proyecto.
**Copia ese contenido** y pégalo en Firebase Console → Storage → Reglas → Publicar.

Antes, asegúrate de que **Storage esté activado** (Storage → Comenzar).

## Qué hacen

Los archivos de un evento (imágenes y documentos) se guardan en `attachments/{workspaceId}/{eventId}/...`
y solo los miembros de esa agenda pueden leerlos o subirlos. La comprobación de membresía se hace
consultando Firestore desde las reglas de Storage (`firestore.exists(...)`), una función estándar de Firebase.

También se conserva la ruta antigua `event-images/{userId}/...` para las imágenes del modelo anterior.

## Si la versión con `firestore.exists` diera problemas

En proyectos donde el acceso de Storage a Firestore no esté disponible, usa esta versión más simple
(permite a cualquier usuario autenticado, con límite de tamaño y solo en la carpeta de adjuntos):

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /attachments/{wsId}/{eventId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.size < 15 * 1024 * 1024;
    }
    match /event-images/{userId}/{eventId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

La versión recomendada (en `storage.rules`) es más segura porque limita la lectura a los miembros de la agenda.
