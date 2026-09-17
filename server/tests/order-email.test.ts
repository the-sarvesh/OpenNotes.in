import assert from "node:assert/strict";
import test from "node:test";
import { orderActivityEmail, type OrderEmailPayload } from "../src/utils/order-email.js";

const basePayload: OrderEmailPayload = {
  event: "placed",
  eventKey: "placed:order-123:buyer:user-1:item:item-1",
  recipientUserId: "user-1",
  role: "buyer",
  orderId: "12345678-1234-1234-1234-123456789abc",
  orderItemId: "item-1",
  listingTitle: "Computer Networks Notes",
  quantity: 2,
  amount: 700,
  counterpartUserId: "user-2",
  meetupPin: "4821",
  meetupLocation: "Noida · Sector 62",
  actionPath: "/orders",
};

test("buyer order email uses OpenNotes branding and includes safe exchange details", () => {
  const email = orderActivityEmail(basePayload, "Sarvesh Soni", "A Buyer & Seller");
  assert.match(email.subject, /Order confirmed: Computer Networks Notes/);
  assert.match(email.html, /Open<span style="color:#ffffff;">Notes\.in<\/span>/);
  assert.match(email.html, /BITSian notes exchange/);
  assert.match(email.html, /₹700/);
  assert.match(email.html, /4821/);
  assert.match(email.html, /A Buyer &amp; Seller/);
  assert.match(email.text, /View order: https:\/\/opennotes\.in\/orders/);
});

test("seller email never exposes the buyer exchange PIN", () => {
  const email = orderActivityEmail({ ...basePayload, role: "seller", recipientUserId: "user-2" }, "Seller", "Buyer");
  assert.doesNotMatch(email.html, /4821/);
  assert.doesNotMatch(email.text, /4821/);
  assert.match(email.text, /You have a new order/);
});

test("order email escapes user-controlled listing and note content", () => {
  const email = orderActivityEmail({
    ...basePayload,
    listingTitle: '<img src=x onerror="alert(1)">',
    note: "Meet at <script>bad()</script>",
  }, "<Admin>", "Seller");
  assert.doesNotMatch(email.html, /<script>|<img/);
  assert.match(email.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(email.html, /&lt;Admin&gt;/);
});

test("meetup lifecycle emails point users to Messages", () => {
  for (const event of ["meetup_proposed", "meetup_accepted", "meetup_declined", "meetup_cancelled", "meetup_reminder"] as const) {
    const email = orderActivityEmail({ ...basePayload, event, actionPath: "/messages" }, "Buyer", "Seller");
    assert.match(email.text, /https:\/\/opennotes\.in\/messages/);
  }
});
