---
paths: ["tests/**", "frontend/src/pages/**"]
---

# Validation rules (UI) and expected messages

- Native checks block submit, no request sent: `required` (`#reg-name/-email/-password`, `#login-email/-password`, price fields), `type=email` (typeMismatch), `minLength=8` on `#reg-password` (tooShort), prices `min=0` (rangeUnderflow) and `step=500` (stepMismatch, so decimals fail). Letters can't be typed into number inputs.
- API errors render in `.notice.notice-error` (`role="alert"`); info in `.notice-info`, success in `.notice-ok` (`role="status"`). Errors clear on the next submit or seat click.
- Register, email taken: "An account with this email already exists."
- Login, wrong email or password: "Wrong email or password."
- Price over 100,000,000: "Number must be less than or equal to 100000000". Price 0 is allowed.
- Hall clash: starts with "The hall is busy:".
- 11th seat: "You can book up to 10 seats at once. For a bigger group, book the whole hall." (info)
- Seat taken while booking (409): "Sorry, these seats were just taken: A3." On refresh: "Sorry, A3 was just taken by someone else."
- Whole hall < 7 days: "Full-hall booking must be made at least 7 days before the show."; any seat booked: "Full-hall booking is only available when no seats are booked."
- Review: "Post review" stays disabled while the comment is blank; the form hides after one review.
- Money shows as `15,000 MMK`.
