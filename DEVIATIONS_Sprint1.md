# Sprint 1 --- Deviations from the Submitted SRS and Test Plan

**Project:** Team 07 --- Event Management System\
**Sprint:** Sprint 1 (19--23 October)\
**Purpose:** Record differences between the submitted Software
Requirements Specification (SRS), Test Plan, and the implementation
available on `main` at the time of review.\
**Baseline reviewed:** Implementation on `main` after PRs #64 and #65,
as recorded in the original deviation log.\
**Status:** Working deviation register --- team confirmation and
traceability updates are still required for the items marked **Open**.

------------------------------------------------------------------------

## 1. Summary

The Sprint 1 implementation covers core event creation, editing,
publishing/cancellation, browsing, registration, and
authentication/authorization work represented by the merged changes
reviewed at this baseline. The implementation also contains design
choices and known limitations that are not fully specified in the
submitted SRS or Test Plan.

This register distinguishes between:

-   **Implemented variation:** the delivered behavior differs from the
    submitted requirement.
-   **Design choice:** the submitted documents do not prescribe the
    behavior.
-   **Not yet implemented:** the requirement or planned test is still
    outstanding.
-   **Verification gap:** the implementation may exist, but the planned
    verification has not been demonstrated.

A documented deviation is **not automatically an approved change**. The
team should confirm the rationale and decide whether to accept the
behavior for this release, change the implementation, or update the
SRS/Test Plan.

## 2. Implementation differences from the SRS

  ----------------------------------------------------------------------------------------------------------------------
  ID          SRS reference            Submitted         Sprint 1 implementation Impact / risk    Status and required
                                       expectation                                                action
  ----------- ------------------------ ----------------- ----------------------- ---------------- ----------------------
  DEV-01      EMS-F-012, EMS-F-015     Registration      There is no separate    Organizers       **Open --- team
                                       deadline behavior registration-deadline   cannot configure decision required.**
                                       is specified in   field; registration     a registration   Confirm the intended
                                       the SRS.          closes when the event   cutoff earlier   business rule. If
                                                         starts (`startDate`).   than the event   accepted, document the
                                                                                 start.           rule in the SRS;
                                                                                                  otherwise add the
                                                                                                  missing field and
                                                                                                  validation.

  DEV-02      EMS-F-012                Venue and         The event model uses    Online-event     **Open --- team
                                       online-event      one required text       links and        decision required.**
                                       information       field, `venue`; there   physical venues  Confirm whether
                                       should satisfy    is no separate          are not          entering a link or
                                       the SRS           online-event URL field. represented as   "Online" in `venue` is
                                       requirement.                              distinct         an accepted Sprint 1
                                                                                 structured       compromise. If
                                                                                 values.          accepted, document it;
                                                                                                  otherwise revise the
                                                                                                  model and UI.

  DEV-03      EMS-F-016                Participants can  A participant can       Cancellation may **Open --- policy
                                       cancel when       cancel an active        remain available decision required.**
                                       cancellation is   registration at any     close to or      Agree on the
                                       permitted.        time; no cancellation   after an event   cancellation policy.
                                                         cutoff rule is          starts.          If no cutoff is
                                                         implemented.                             intended for this
                                                                                                  release, state that
                                                                                                  explicitly in the SRS.

  DEV-04      EMS-F-010                Search events by  Search matches title,   This expands     **Implemented
                                       title or          description, and venue; text-search      variation --- confirm
                                       category.         category is available   coverage beyond  acceptance.** Verify
                                                         as a separate filter.   the stated       the final UI/API
                                                                                 fields. The      behavior and update
                                                                                 separate         the SRS if this
                                                                                 category filter  expanded search is
                                                                                 should remain    retained.
                                                                                 clear to users.  

  DEV-05      EMS-F-009; EMS-F-004     Participants can  Event browsing requires Anonymous        **Open ---
                                       view published    login.                  visitors cannot  requirements
                                       events; protected                         browse published clarification
                                       functions require                         events, even     required.** Confirm
                                       authentication.                           though the       whether browsing is
                                                                                 event-listing    intentionally
                                                                                 requirement may  protected. Align
                                                                                 imply public     EMS-F-009 and
                                                                                 discovery.       EMS-F-004 so their
                                                                                                  access expectations do
                                                                                                  not conflict.

  DEV-06      SRS §5.4                 Registrations     The application counts  Concurrent       **Known limitation ---
              (reliability/capacity)   must not exceed   active registrations    requests for the follow-up required.**
                                       event capacity.   and then creates a      last available   Record as a release
                                                         registration; the check seat could both  risk. Implement and
                                                         and write are not       pass the count   test an
                                                         atomic.                 check and        atomic/transactional
                                                                                 overbook the     or otherwise
                                                                                 event. Mocked    concurrency-safe
                                                                                 tests do not     approach before
                                                                                 establish        claiming the capacity
                                                                                 database-level   guarantee is fully
                                                                                 concurrency      enforced.
                                                                                 safety.          
  ----------------------------------------------------------------------------------------------------------------------

## 3. Design choices not specified by the SRS

These items are recorded as implementation decisions rather than
confirmed requirement deviations. The team should confirm that each is
intentional and acceptable.

  -------------------------------------------------------------------------------------------
  ID             Design choice       Current behavior    Product / security Required action
                                                         consideration      
  -------------- ------------------- ------------------- ------------------ -----------------
  DC-01          Self-registration   Sign-up allows      Helps prevent      Confirm how Admin
                 roles               Participant or      users from         accounts are
                                     Organizer; Admin    granting           provisioned and
                                     accounts cannot     themselves         document the
                                     self-register.      administrative     process.
                                                         privileges.        

  DC-02          Password length     Passwords must be   This is an         Confirm the limit
                                     8--72 characters.   implementation     and document it
                                                         constraint and     in the SRS or
                                                         should be          security
                                                         reflected in       requirements.
                                                         validation         
                                                         messages and       
                                                         requirements if    
                                                         retained.          

  DC-03          Email normalization Email is            Supports           Ensure behavior
                                     case-insensitive.   consistent account is tested and
                                                         matching.          document it if it
                                                                            is part of the
                                                                            intended
                                                                            contract.

  DC-04          Event lifecycle     Events start as     Prevents           Confirm lifecycle
                                     `draft`; only       unpublished events transitions and
                                     published events    from appearing in  keep them
                                     can be browsed or   the participant    consistent across
                                     registered for.     workflow.          API, UI, and
                                                                            tests.

  DC-05          Registration        Registrations use   Preserves          Confirm this
                 history             `active` /          cancellation state matches the
                                     `cancelled` status  while allowing     intended business
                                     and a partial       re-registration.   rule and complete
                                     unique index; a     Database index     database-level
                                     participant may     behavior should be verification.
                                     register again      verified against a 
                                     after cancellation. real MongoDB       
                                                         instance.          

  DC-06          Admin route access  Admins may use      This is a          Confirm and
                                     organizer event     role-policy        document the
                                     routes.             decision that      intended
                                                         affects            role-permission
                                                         authorization      matrix; test both
                                                         behavior.          allowed and
                                                                            denied actions.
  -------------------------------------------------------------------------------------------

## 4. SRS requirements not yet implemented at the reviewed baseline

The following items were listed as outstanding in the original Sprint 1
review. Their status should be rechecked against the latest `main`
before the final demo.

  -----------------------------------------------------------------------
  SRS / requirement area  Outstanding             Required action
                          functionality recorded  
  ----------------------- ----------------------- -----------------------
  EMS-F-018 to EMS-F-020  Organizer registration  Confirm whether these
                          count and participant   remain out of scope for
                          list.                   Sprint 1; record the
                                                  planned sprint or
                                                  accepted deferral.

  EMS-F-021 to EMS-F-023  Administrator user and  Confirm delivery status
                          event management.       and document any
                                                  approved deferral.

  EMS-F-024 to EMS-F-027; Notifications and audit Confirm delivery status
  EMS-SR-005              records.                and document any
                                                  approved deferral.

  Registration history    Participant-facing      Confirm whether it is
                          registration history.   required for this
                                                  sprint/release and
                                                  record the plan.

  Participant profiles    Participant profile     Confirm whether it is
                          functionality.          required for this
                                                  sprint/release and
                                                  record the plan.

  EMS-SR-001 to           Security hardening was  Recheck the submitted
  EMS-SR-004; SEC-01 to   scheduled for Sprint 2  plan and current
  SEC-03                  in the original log.    implementation; do not
                                                  present scheduled work
                                                  as completed until
                                                  verified.
  -----------------------------------------------------------------------

**Important:** "Not yet implemented" is a status at a specific baseline,
not a permanent conclusion. Reconcile this section with the current
repository and sprint backlog before presenting it.

## 5. Test Plan and verification differences

  -------------------------------------------------------------------------------------------------------------------------
  ID             Test Plan /          Current evidence recorded      Limitation / risk         Required action
                 verification area                                                             
  -------------- -------------------- ------------------------------ ------------------------- ----------------------------
  TV-01          Database-dependent   Automated tests use a mocked   Mocked tests cannot prove Run the relevant checks
                 tests, including     database.                      real MongoDB index        against a real test database
                 TC-SEC-01                                           enforcement, stored data  and retain the results.
                                                                     properties, or            
                                                                     transaction/concurrency   
                                                                     behavior.                 

  TV-02          UI/browser tests     No UI/browser tests were       API tests alone do not    Add browser/UI checks if
                                      recorded.                      prove that users can      required by the Test Plan,
                                                                     complete the browsing     or document an agreed
                                                                     workflow in the           deferral.
                                                                     interface.                

  TV-03          Performance testing, No performance test was        Response-time and load    Execute the planned
                 TC-PERF-01           recorded.                      behavior remain           performance test or document
                                                                     unverified.               its deferral and acceptance
                                                                                               criteria.

  TV-04          Capacity race/data   No                             The non-atomic capacity   Add
                 integrity,           capacity-race/data-integrity   check may permit          concurrency/database-level
                 TC-DATA-01           test was recorded.             overbooking under         verification after
                                                                     concurrent requests.      implementing a safe capacity
                                                                                               strategy.

  TV-05          SRS-to-test          The original SRS traceability  The submitted             Update each requirement
                 traceability         table still marks requirements traceability table does   using verified evidence;
                                      as `N`.                        not demonstrate which     distinguish implemented,
                                                                     requirements have         tested, partially tested,
                                                                     implementation and test   and not implemented.
                                                                     evidence.                 
  -------------------------------------------------------------------------------------------------------------------------

## 6. Decisions required from the team

Before finalizing this register, record a decision and owner for each
open item:

1.  **Registration deadline:** Is closing at `startDate` the accepted
    Sprint 1 rule, or is a separate deadline required?
2.  **Online events:** Is the single `venue` field an accepted temporary
    representation, or is a dedicated online URL required?
3.  **Cancellation policy:** Is cancellation allowed at any time, or
    should there be a cutoff?
4.  **Public browsing:** Must unauthenticated visitors be able to browse
    published events?
5.  **Capacity safety:** What concurrency-safe mechanism will prevent
    overbooking, and when will it be verified?
6.  **Outstanding requirements/tests:** Which are accepted deferrals,
    and which must be completed before release?

Do not fill in a rationale just to make the table look complete. Record
the actual team decision, its date, and the responsible person.

## 7. Final-demo checklist

-   [ ] Recheck this register against the latest `main`, not only the
    earlier PR #64/#65 baseline.
-   [ ] Confirm each claimed behavior in the implementation and tests.
-   [ ] Resolve or explicitly record the decisions in Section 6.
-   [ ] Update the SRS and Test Plan where the team accepts a changed
    requirement or test scope.
-   [ ] Update SRS-to-test traceability using evidence rather than
    assumptions.
-   [ ] Clearly explain outstanding features, verification gaps, and
    known risks during the final demo.
-   [ ] Demonstrate the working product as required by the Sprint 1
    instructions.
-   [ ] Keep this file in the repository and upload the required
    one-minute Sprint 1 demo video.

## 8. Change history

  -----------------------------------------------------------------------
  Version                             Description
  ----------------------------------- -----------------------------------
  0.1                                 Initial Sprint 1 deviation log
                                      based on the implementation after
                                      PRs #64 and #65.

  0.2                                 Reorganized deviations, design
                                      choices, unimplemented
                                      requirements, verification gaps,
                                      risks, and team decisions into
                                      separate tracked sections.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

**Review note:** This document records the differences and verification
gaps identified in the supplied deviation log. The implementation status
and rationale for open items must be confirmed against the latest
repository, submitted SRS/Test Plan, and actual team decisions before
final submission.
