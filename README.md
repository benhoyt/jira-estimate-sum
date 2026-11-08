
# Jira estimate sum extension

This is a Firefox extension that shows the sum of the time estimate in the "Original estimate" column on a Jira board "list" page.

This was vibe-coded, using Pi and GLM 5.3 (if I remember correctly), and then lightly reviewed.

It uses the Jira REST API with the current credentials to fetch the "originalestimate" field values using the currently-shown filters.
