import type { Order, OrderStatus, TrackingEvent } from "@/types";
import { addresses } from "./users";

/**
 * Mock order history. Texts shown to shoppers (status names, delivery option,
 * payment method) are keys that the UI translates — see messages/*.json → orders.
 * Item thumbnails come from the live catalogue at render time.
 */
export const trackingSteps: { status: OrderStatus }[] = [
  { status: "placed" },
  { status: "packed" },
  { status: "shipped" },
  { status: "out_for_delivery" },
  { status: "delivered" },
];

export function buildTracking(
  status: OrderStatus,
  dates: Partial<Record<OrderStatus, string>>,
  locations: Partial<Record<OrderStatus, string>> = {},
): TrackingEvent[] {
  const reached = trackingSteps.findIndex((s) => s.status === status);
  return trackingSteps.map((step, i) => ({
    status: step.status,
    label: step.status,
    date: dates[step.status],
    location: locations[step.status],
    done: i <= reached,
  }));
}

export const orders: Order[] = [
  {
    id: "VD-482913",
    createdAt: "2026-09-28T14:12:00Z",
    status: "shipped",
    items: [
      { productId: "p43", title: "Supreme Plush Hotel Towel", image: "", price: 36, quantity: 2, variant: { color: "Stone", size: "Bath towel" }, sellerName: "Loomhouse Textiles" },
      { productId: "p52", title: "Tufted Cotton Bath Mat", image: "", price: 32, quantity: 1, variant: { color: "Stone" }, sellerName: "Loomhouse Textiles" },
    ],
    subtotal: 104,
    shipping: 0,
    tax: 7.7,
    total: 104,
    address: addresses[0],
    paymentMethod: "card:Visa:4417",
    deliveryOption: "fast",
    estimatedDelivery: "2026-10-06T18:00:00Z",
    tracking: buildTracking(
      "shipped",
      { placed: "2026-09-28T14:12:00Z", packed: "2026-09-29T09:40:00Z", shipped: "2026-09-30T16:05:00Z" },
      { packed: "Denizli", shipped: "İstanbul" },
    ),
    customerName: "Alex Morgan",
  },
  {
    id: "VD-471205",
    createdAt: "2026-09-10T08:30:00Z",
    status: "delivered",
    items: [
      { productId: "p56", title: "The Essentials Towel Bundle", image: "", price: 64, quantity: 1, variant: { color: "Oat", size: "6-piece" }, sellerName: "Loomhouse Textiles" },
      { productId: "p48", title: "Hooded Baby Towel", image: "", price: 24, quantity: 1, variant: { color: "Blush" }, sellerName: "Loomhouse Textiles" },
    ],
    subtotal: 88,
    shipping: 0,
    tax: 6.52,
    total: 88,
    address: addresses[0],
    paymentMethod: "card:Mastercard:0921",
    deliveryOption: "standard",
    estimatedDelivery: "2026-09-15T18:00:00Z",
    tracking: buildTracking(
      "delivered",
      {
        placed: "2026-09-10T08:30:00Z",
        packed: "2026-09-10T15:00:00Z",
        shipped: "2026-09-11T10:20:00Z",
        out_for_delivery: "2026-09-14T07:45:00Z",
        delivered: "2026-09-14T13:02:00Z",
      },
      { shipped: "Denizli", out_for_delivery: "Portland, OR", delivered: "Springfield, OR" },
    ),
    customerName: "Alex Morgan",
  },
  {
    id: "VD-490077",
    createdAt: "2026-10-04T19:55:00Z",
    status: "placed",
    items: [{ productId: "p55", title: "Plush Shawl-Collar Robe", image: "", price: 92, quantity: 1, variant: { color: "Chalk", size: "M" }, sellerName: "Loomhouse Textiles" }],
    subtotal: 92,
    shipping: 0,
    tax: 6.81,
    total: 92,
    address: addresses[1],
    paymentMethod: "wallet",
    deliveryOption: "standard",
    estimatedDelivery: "2026-10-10T18:00:00Z",
    tracking: buildTracking("placed", { placed: "2026-10-04T19:55:00Z" }),
    customerName: "Alex Morgan",
  },
];
