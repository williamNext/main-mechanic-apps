# Easy First Notifications Spec

## Current Scope

Implemented now:
- In-app notifications for clients and mechanics.
- Notification list pages in mobile/web Expo routes.
- Unread badge in bottom navigation.
- Booking confirmation modal after successful booking.
- Booking and cancellation events create persisted notifications.
- Client and mechanic profile screens expose editable basic data.
- Phone field remains read-only until verification flow exists.

Deferred:
- Phone OTP confirmation.
- Password recovery by phone code.
- WhatsApp delivery.
- SMS fallback.
- Expo push delivery and token registration.
- Admin notification template editor.

## Notification Behavior

Notification rows live in `public.notifications`.

Supported v1 event types:
- `appointment_confirmed`: created when client books appointment.
- `appointment_canceled`: created when client or mechanic cancels appointment.
- `appointment_completed`: reserved for service closeout.
- `system`: reserved for operational notices.

User rules:
- Authenticated users can read own notifications.
- Authenticated users can mark own notifications read.
- Admins can read all notifications for support.
- Apps cannot directly insert notifications; appointment RPCs own event creation.

Retention:
- Target retention is 180 days.
- Cleanup job deferred until scheduled functions are implemented.

## Appointment Behavior

Booking:
- Client selects mechanic slot and confirms booking.
- Supabase RPC creates appointment and sets timeslot unavailable.
- RPC creates client confirmation notification.
- RPC creates mechanic new-appointment notification.
- App shows immediate confirmation modal.

Cancellation:
- Client or mechanic confirms cancellation.
- RPC marks appointment `cancelado`.
- RPC sets `timeslots.is_available = true`.
- RPC creates notifications for both affected parties.

## Profile Behavior

Client:
- Profile > Meus Dados opens editable name form.
- Phone displays read-only.
- Phone copy explains verification-by-code is deferred.

Mechanic:
- Profile screen edits name and specialty.
- Phone displays read-only.
- Phone copy explains verification-by-code is deferred.

## Acceptance Criteria

- Booking creates appointment, shows confirmation modal, and adds unread notification.
- Cancellation changes appointment status and frees mechanic timeslot.
- Cancellation adds unread notification for affected client/mechanic.
- Notification page lists latest 50 notifications newest first.
- Tapping unread notification marks it read.
- Mark all read clears unread badge.
- Profile basic fields save without allowing phone edits.
