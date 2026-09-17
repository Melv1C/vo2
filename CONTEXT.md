# VO2 training planning

Shared language for planned training in VO2 and its relationship to imported activity data.

## Planned training

**Planned workout**:
A workout the athlete intends to do on a calendar date. It is separate from any completed activity imported from Strava, and a date may contain multiple planned workouts.

**Activity**:
A completed workout imported from Strava. An activity is historical training data, not a plan.
_Avoid_: Planned workout, session

**Calendar date**:
The athlete's local day on which a planned workout belongs. Planned workouts do not have a time of day in the first version.
_Avoid_: Timestamp, UTC date

**Sport**:
A value from the fixed set `cycling`, `running`, `swimming`, `walking`, `strength`, `mobility`, or `other`.
_Avoid_: Free-text sport

**Duration**:
The planned workout length, stored and presented as a number of minutes. The AI asks the athlete when a request does not include a duration.

**Workout notes**:
Optional athlete-provided context attached to a planned workout. Notes do not define structured intensity or training targets.

## Planning behavior

**Confirmed AI mutation**:
An AI-created, edited, or deleted planned workout that only changes data after the athlete explicitly confirms the proposed change in chat.

**Automatic matching**:
Linking a planned workout to a Strava activity without the athlete doing it manually. VO2 does not perform this matching in the first version.

**Training calendar**:
A monthly view that shows planned workouts and completed Strava activities on their calendar dates. The two record types use different visual treatments and are not implied to be linked.
