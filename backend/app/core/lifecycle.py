from app.services.common import conflict

QUOTE_TRANSITIONS = {"issue": ({"draft"}, "quotation"), "confirm": ({"quotation"}, "confirmed"),
                     "close": ({"draft", "quotation", "confirmed"}, "closed")}
SUBSCRIPTION_TRANSITIONS = {"activate": ({"confirmed"}, "active"), "pause": ({"active"}, "paused"),
                           "resume": ({"paused"}, "active"), "close": ({"confirmed", "active", "paused"}, "closed")}


def transition(current: str, action: str, rules) -> str:
    allowed, target = rules[action]
    if current == target:
        return target
    if current not in allowed:
        raise conflict("This lifecycle transition is not allowed from the current state.")
    return target
