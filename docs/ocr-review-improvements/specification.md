# Functional specification

## 1. OCR row matching

Observed failures: neighbouring employees' times were associated with the wrong person; blank rows produced proposals; worked rows were missed; some breaks were unreadable.

Requirements:
- Match names and time cells using their positions in the same table row.
- Account for perspective distortion and partially obscured headings.
- Return null for ambiguous values; do not substitute neighbouring values or infer dates from photo filenames.
- Preserve raw OCR values, confidence information and available source coordinates.
- Keep all OCR proposals unconfirmed, including apparently clear readings.
- Ignore the food column completely.

Acceptance:
- Fictional fixtures cover blank rows, adjacent rows, tilted photos, obscured dates and unclear breaks.
- Neighbouring times must not be accepted as confident readings for another employee.
- An obscured date remains unresolved until explicitly reviewed.
- OCR cannot directly add minutes to confirmed totals.

## 2. Reversible dismissal

Problem: clearing a false proposal leaves an unresolved row without a useful way to finish review.

Requirements:
- Add a reversible dismissal action with distinct reasons for 'Not worked' and 'Incorrect OCR row'. Incorrect extraction does not itself prove the employee did not work.
- Preserve the original extraction and review history.
- Exclude dismissed proposals from totals and the active review queue.
- Provide a dismissed-proposals view with a restore action.
- Rescans must respect recorded dismissals instead of automatically recreating the same proposal.
- Use a stable document/row identity; do not rely only on filenames that organization can change.
- Restoring a proposal returns it to review, not directly to confirmed status.

Acceptance:
- Dismiss, reload, rescan and restore retain the correct state.
- Dismissal remains effective after organizing or renaming the source photo.
- A dismissed false proposal can be replaced with a valid reviewed row without blocking entry or duplicating hours.

## 3. Review progress and request handling

Requirements:
- Preserve employee, date and status filters across rescans and navigation within the week.
- Keep the selected paper and scroll position where practical.
- Avoid delayed full-page reloads that interrupt interaction.
- Protect unsaved drafts when extraction refreshes other rows.
- Show saving states and prevent duplicate submissions.
- Display actionable errors without losing entered values.
- Make successful additions discoverable even when the current filter hides them.

Acceptance:
- Adding or correcting one row does not reset filters, discard another draft or move selection to a different paper.
- Repeated clicks during a pending request do not create duplicate rows.
- Failed requests preserve entered values and permit retry.

## 4. Auditable corrections

Requirements:
- Store original extraction separately from reviewed values.
- Record previous value, new value, timestamp and correction reason; use an existing reviewer identity if available, without inventing one.
- Editing a confirmed row removes its confirmation until explicitly confirmed again.
- Explicitly cleared fields remain null after reload and rescan.
- Rescans preserve manually corrected and confirmed values. Any conflicting new extraction is a visible proposal, not an overwrite.
- Preserve audit and dismissal data through backups and restores.
- Migrate existing profiles without losing current values. Do not fabricate historical raw values or reviewer events that were never recorded.

Acceptance:
- A corrected row retains original extraction and an inspectable change history.
- Cleared or incomplete rows cannot be confirmed or included in totals.
- Rescanning cannot revert a manual correction.
- Backup/restore round trips retain corrections and dismissals.

## 5. Source verification

Requirements:
- Base row magnification on detected source coordinates, not alphabetical employee order.
- Highlight the cells supporting the selected proposal.
- Keep coordinates tied to the correct image version and handle any preprocessing transform.
- Fall back to the full photo when reliable coordinates are unavailable.
- Make uncertain start, finish, break and date fields individually visible.
- Clearly label uncertain source positioning.

Acceptance:
- Selecting an employee highlights that employee's actual source row when coordinates exist.
- Resizing the view preserves correct highlighting.
- Missing or unreliable coordinates do not create a misleading crop.

## Non-goals

No automatic confirmation, roster-derived actual hours, payroll entitlement calculations, hosted employee-data processing, or replacement of the deterministic calculation engine.
