from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Totals:
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    lines: list[dict]


def calculate(lines, discount: Decimal = ZERO) -> Totals:
    """Allocate discount in integer cents by largest remainder, then tax each line."""
    subtotals = [money(line.unit_price * line.quantity) for line in lines]
    subtotal = sum(subtotals, ZERO)
    discount = min(money(discount), subtotal)
    if discount < 0:
        raise ValueError("Discount cannot be negative.")
    cents = int(discount / CENT)
    shares = [(Decimal(cents) * value / subtotal if subtotal else ZERO) for value in subtotals]
    allocations = [int(share) for share in shares]
    remainder_order = sorted(range(len(lines)), key=lambda i: (-(shares[i] - allocations[i]), i))
    for index in remainder_order[:cents - sum(allocations)]:
        allocations[index] += 1
    result = []
    for index, line in enumerate(lines):
        allocated = Decimal(allocations[index]) * CENT
        tax = money((subtotals[index] - allocated) * line.tax_rate / Decimal(100))
        result.append({"subtotal": subtotals[index], "discount": allocated,
                       "tax": tax, "total": subtotals[index] - allocated + tax})
    tax = sum((line["tax"] for line in result), ZERO)
    return Totals(subtotal, discount, tax, subtotal - discount + tax, result)
