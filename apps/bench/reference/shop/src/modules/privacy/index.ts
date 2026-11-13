// Erasing a person (R4): the personal data goes; orders, payments, returns, invoices,
// credit notes, stock movements and the points history stay, without the person.
import { invalidState } from '../../errors';
import * as customers from '../customers';
import * as loyalty from '../loyalty';
import * as orders from '../orders';
import * as invoicing from '../invoicing';

export function eraseCustomer(id: string): customers.Customer {
  const customer = customers.getCustomer(id);
  if (customer.erased) return customer;
  if (orders.hasOpenOrders(id)) throw invalidState('the customer has orders that are not finished');
  orders.anonymise(id);
  invoicing.anonymise(id);
  loyalty.writeOff(id);
  customers.forget(id);
  return customers.getCustomer(id);
}

/**
 * Removes a customer in one go (R4: the person goes, the books stay). The orders that stand in the way of erasing are
 * cleared first: one waiting for payment is cancelled; one that is paid and of which nothing has gone out is called off
 * and its money given back in full through `refund`. An order of which a part is on its way stops the removal. Then
 * the customer is erased as above. When a refund fails the removal stops there; what was called off stays called off.
 */
export async function removeCustomer(id: string, refund: (orderId: string, amountCents: number) => Promise<void>): Promise<customers.Customer> {
  const customer = customers.getCustomer(id);
  if (customer.erased) return customer;
  const open = orders.openOrders(id);
  if (open.some((o) => o.status === 'paid' && o.lines.some((l) => l.shippedQuantity > 0))) throw invalidState('an order of the customer is partly on its way');
  for (const o of open) {
    if (o.status === 'pending') orders.cancelOrder(o.id);
    else {
      await refund(o.id, o.totalCents);
      orders.callOff(o.id);
    }
  }
  return eraseCustomer(id);
}
