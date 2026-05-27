# Reglas sugeridas de Firestore

Estas reglas son para una primera version interna. Despues deben endurecerse por roles.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
    }

    match /events/{eventId} {
      allow read, create, update, delete: if request.auth != null;
    }
  }
}
```

Para produccion con mas usuarios, conviene limitar eventos por propietario, familia, rol o equipo.
