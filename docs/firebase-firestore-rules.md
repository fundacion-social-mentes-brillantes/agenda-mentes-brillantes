# Reglas de Firestore

Las reglas oficiales y actualizadas están en el archivo [`firestore.rules`](../firestore.rules) en la raíz
del proyecto. **Copia ese contenido** y pégalo en Firebase Console → Firestore Database → Reglas → Publicar.

## Qué hacen

- **users/{uid}**: cada quien lee/escribe su propio perfil.
- **workspaces/{wsId}**: solo los miembros leen la agenda; solo el dueño la edita o elimina.
- **workspaces/{wsId}/members/{uid}**: te puedes unir si eres el dueño o si traes el código de invitación correcto.
- **Consulta de grupo `members`**: permite a cada usuario listar las agendas a las que pertenece.
- **events/{eventId}**: solo los miembros de la agenda del evento pueden verlo o editarlo.
  Los eventos antiguos sin `workspaceId` solo los ve y migra su creador (para la migración automática).

## Migración de eventos antiguos

La app, al entrar por primera vez, mueve los eventos viejos (sin agenda) a la agenda personal del usuario.
Las reglas permiten esa operación solo al creador del evento. Es automática y ocurre una sola vez.
