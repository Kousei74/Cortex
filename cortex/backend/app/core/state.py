from app.schemas.report import JobStatus

class InvalidTransitionError(ValueError):
    """Raised when an invalid state transition is attempted."""
    pass

class JobStateMachine:
    """
    State Machine for CORTEX Jobs.
    
    Allowed Transitions:
    PENDING -> PROCESSING
    PROCESSING -> COMPLETED
    PROCESSING -> FAILED
    FAILED -> PENDING (Retry - explicitly handled by creating new job or resetting)
    
    Terminal States:
    COMPLETED
    FAILED (Terminal for the workflow, unless manual intervention)
    """
    
    ALLOWED_TRANSITIONS = {
        JobStatus.PENDING: {JobStatus.PROCESSING},
        JobStatus.PROCESSING: {JobStatus.COMPLETED, JobStatus.FAILED},
        JobStatus.COMPLETED: set(),  # Terminal
        JobStatus.FAILED: {JobStatus.PENDING}, # Allow manual retry reset
    }

    @classmethod
    def validate_transition(cls, current_status: JobStatus, new_status: JobStatus):
        """
        Validates if the transition from current_status to new_status is allowed.
        Raises InvalidTransitionError if not allowed.
        """
        # Allow idempotent updates (same status)
        if current_status == new_status:
            return

        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise InvalidTransitionError(
                f"Invalid transition from {current_status} to {new_status}. "
                f"Allowed: {allowed}"
            )
