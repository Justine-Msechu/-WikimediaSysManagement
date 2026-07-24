import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, where,
} from "../firebase/firestore";
import { orderBy } from "firebase/firestore";

export const INVOICE_STATUSES = ["draft", "sent", "paid"];

export async function getInvoices() {
  return getCollection("invoices", orderBy("createdAt", "desc"));
}

export async function addInvoice(data) {
  return addDocument("invoices", data);
}

export async function updateInvoice(id, data) {
  return updateDocument("invoices", id, data);
}

export async function deleteInvoice(id) {
  return deleteDocument("invoices", id);
}

export function listenInvoices(callback) {
  return listenCollection("invoices", callback, orderBy("createdAt", "desc"));
}

export function listenInvoicesByGrant(grantId, callback) {
  return listenCollection("invoices", callback, where("grantId", "==", grantId));
}

export async function getInvoicesByGrant(grantId) {
  return getCollection("invoices", where("grantId", "==", grantId));
}
