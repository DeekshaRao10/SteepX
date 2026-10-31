import calendar
from datetime import date, timedelta


def period_boundary(anchor: date, interval: str, index: int) -> date:
    """Calculate from the original anchor, never from a previously clamped date."""
    if index < 0:
        raise ValueError("Period index must be nonnegative.")
    if interval == "daily":
        return anchor + timedelta(days=index)
    if interval == "weekly":
        return anchor + timedelta(days=7 * index)
    if interval not in {"monthly", "yearly"}:
        raise ValueError("Unsupported billing interval.")
    absolute_month = anchor.year * 12 + anchor.month - 1 + index * (12 if interval == "yearly" else 1)
    year, month_index = divmod(absolute_month, 12)
    month = month_index + 1
    last_day = calendar.monthrange(year, month)[1]
    anchor_is_end = anchor.day == calendar.monthrange(anchor.year, anchor.month)[1]
    return date(year, month, last_day if anchor_is_end else min(anchor.day, last_day))
