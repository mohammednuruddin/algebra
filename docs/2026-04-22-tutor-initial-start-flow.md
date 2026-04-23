# Initial Tutor Flow Refactoring

## Previous Implementation
Previously, when the user navigated to the live tutor page (`TutorExperience` component), the application would immediately check for an active `snapshot`. If no snapshot was found and the phase was `intake`, it would automatically queue a microtask to execute `startSession()`.
During this loading phase, the entire user interface was replaced with a minimal loading screen stating "Preparing the tutor conversation...". The actual tutor interface (`TutorShell`), including the sidebar and the main canvas, would not render until the backend generated the initial session snapshot. 
Once the snapshot loaded, the UI rendered, and the user had to manually click an "Enable voice and mic" button located in the sidebar footer to activate text-to-speech (TTS) and speech-to-text (STT).

## Changed Implementation
The flow was redesigned to provide a more engaging and user-controlled onboarding experience:

1. **Deferred Session Start**: The `startSession()` call is now deferred. A new `hasStarted` boolean state was introduced to `TutorExperience`, defaulting to `false`.
2. **Immediate UI Render**: Instead of showing a blank loading screen, a `dummySnapshot` is passed to the `TutorShell` to allow the sidebar and main canvas framework to render immediately upon page load. The left panel shows a "Welcome to Algebra" state, while the right canvas remains empty but active.
3. **Animated "Start" Kickstart**: An `isPendingStart` prop is now passed to `TutorShell`. When true:
   - The lessons history sidebar remains visible.
   - The live tutor transcript pane and canvas pane stay hidden until the first real tutor turn arrives.
   - A single centered start surface is rendered with the welcome text above a large animated "Start" button. The button keeps the premium, pulsating blurred gradient border (`animate-pulse`) and hover/active micro-animations (`group-hover:scale-110`, `group-active:scale-95`).
4. **Unified Activation**: When the user clicks the central "Start" button:
   - Voice and microphone unlock is requested immediately (`setVoiceUnlockRequested(true)`), granting STT and TTS access seamlessly without requiring a secondary click.
   - The `hasStarted` state is toggled to `true`.
   - The `startSession()` call is fired directly from the click handler instead of a follow-up effect.
   - The lessons history sidebar still remains visible, but the app stays on the same centered start surface while the first intake turn loads.
   - Instead of swapping to a full-screen prep screen or prematurely revealing the live tutor panes, the shell shows an in-context loading message: "Starting your live tutor. One sec..."
   - Once the tutor is already live, later wait states must use a thinking label rather than lesson-preparation wording so the UI stays truthful about what phase the learner is in.
   - TTS playback and STT streaming stay suppressed during this startup placeholder, so the first spoken line the learner hears is the actual tutor intake question.
   - Once the backend responds, the session begins with the tutor initiating the intake phase (asking for the topic) and utilizing the already-unlocked audio capabilities.
5. **Persistent Sidebar Preference**:
   - The lessons sidebar collapse state is now saved in both local storage and a cookie.
   - The cookie is read on the server for the home page, so refreshes render the sidebar in the correct state on the very first paint instead of flashing open first and collapsing later.
   - If the learner closes or opens the sidebar, that preference survives page reloads and later visits.

These changes significantly improve the UX by presenting a complete interface immediately, giving the user explicit control over when the session starts, and consolidating session initialization with media permissions into a single, highly-polished interaction point.
