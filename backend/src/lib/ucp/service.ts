import {
  addToCartWorkflowId,
  addShippingMethodToCartWorkflow,
  completeCartWorkflowId,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflowId,
  createPaymentSessionsWorkflow,
  deleteLineItemsWorkflowId,
  updateCartWorkflowId,
} from "@medusajs/medusa/core-flows"
import type { MedusaRequest } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"

import {
  UCP_CONTINUE_URL_BASE,
  UCP_DEFAULT_REGION_ID,
  UCP_FAQ_URL,
  UCP_MCP_ENDPOINT,
  UCP_PRIVACY_URL,
  UCP_REFUND_URL,
  UCP_REST_ENDPOINT,
  UCP_SHIPPING_URL,
  UCP_TERMS_URL,
  UCP_VERSION,
} from "../constants"
import type {
  UcpCheckoutCompleteInput,
  UcpCheckoutCreateInput,
  UcpCheckoutUpdateInput,
  UcpDeliveryAddressInput,
  UcpPaymentInput,
} from "./schemas"

export type Scope = MedusaRequest["scope"]

type UcpStatus =
  | "incomplete"
  | "requires_escalation"
  | "ready_for_complete"
  | "complete_in_progress"
  | "completed"
  | "canceled"

type UcpMessage =
  | {
      type: "error"
      code: string
      content: string
      severity:
        | "recoverable"
        | "requires_buyer_input"
        | "requires_buyer_review"
      path?: string
      content_type?: "plain" | "markdown"
    }
  | {
      type: "warning"
      code: string
      content: string
      path?: string
      content_type?: "plain" | "markdown"
    }
  | {
      type: "info"
      code?: string
      content: string
      path?: string
      content_type?: "plain" | "markdown"
    }

type CheckoutBuildOptions = {
  status?: UcpStatus
  messages?: UcpMessage[]
  order?: { id: string } | null
}

const UCP_SERVICE_KEY = "dev.ucp.shopping"
const UCP_CHECKOUT_CAPABILITY_KEY = "dev.ucp.shopping.checkout"
const UCP_FULFILLMENT_CAPABILITY_KEY = "dev.ucp.shopping.fulfillment"
const UCP_MEDUSA_PAYMENT_HANDLER_KEY = "com.medusa.payment"

const CHECKOUT_FIELDS = [
  "id",
  "currency_code",
  "email",
  "created_at",
  "completed_at",
  "total",
  "subtotal",
  "tax_total",
  "discount_total",
  "shipping_total",
  "region_id",
  "metadata",
  "items.id",
  "items.variant_id",
  "items.title",
  "items.unit_price",
  "items.quantity",
  "items.thumbnail",
  "shipping_methods.id",
  "shipping_methods.amount",
  "shipping_methods.shipping_option_id",
  "shipping_address.id",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "billing_address.id",
  "billing_address.first_name",
  "billing_address.last_name",
  "billing_address.phone",
  "*payment_collection",
  "*payment_collection.payment_sessions",
]

const ORDER_FIELDS = ["id"]

export const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (value && typeof value === "object" && "rows" in value) {
    const rows = (value as { rows?: T[] }).rows
    if (Array.isArray(rows)) {
      return rows
    }
  }

  return []
}

export const toMinorUnits = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }

  return 0
}

const getContinueUrl = (checkoutId: string) =>
  `${UCP_CONTINUE_URL_BASE.replace(/\/$/, "")}/checkout-sessions/${checkoutId}`

const getOrderPermalink = (orderId: string) =>
  `${UCP_CONTINUE_URL_BASE.replace(/\/$/, "")}/order/${orderId}`

export const getDefaultLinks = () => {
  const links: Array<{ type: string; url: string }> = [
    { type: "terms_of_service", url: UCP_TERMS_URL },
    { type: "privacy_policy", url: UCP_PRIVACY_URL },
  ]

  if (UCP_REFUND_URL) {
    links.push({ type: "refund_policy", url: UCP_REFUND_URL })
  }

  if (UCP_SHIPPING_URL) {
    links.push({ type: "shipping_policy", url: UCP_SHIPPING_URL })
  }

  if (UCP_FAQ_URL) {
    links.push({ type: "faq", url: UCP_FAQ_URL })
  }

  return links
}

const buildPaymentHandlers = (providerIds: string[]) => {
  const normalized = providerIds.length
    ? providerIds
    : ["pp_system_default"]

  return {
    [UCP_MEDUSA_PAYMENT_HANDLER_KEY]: normalized.map((providerId) => ({
      id: providerId,
      version: UCP_VERSION,
      available_instruments: [{ type: "card" }],
      config: {
        provider_id: providerId,
      },
    })),
  }
}

const buildCheckoutResponseUcp = (providerIds: string[]) => {
  return {
    version: UCP_VERSION,
    capabilities: {
      [UCP_CHECKOUT_CAPABILITY_KEY]: [{ version: UCP_VERSION }],
      [UCP_FULFILLMENT_CAPABILITY_KEY]: [{ version: UCP_VERSION }],
    },
    payment_handlers: buildPaymentHandlers(providerIds),
  }
}

const deriveStatus = (cart: any, explicitStatus?: UcpStatus): UcpStatus => {
  if (explicitStatus) {
    return explicitStatus
  }

  if (cart?.metadata?.ucp_status === "canceled") {
    return "canceled"
  }

  if (cart?.completed_at) {
    return "completed"
  }

  const hasItems = (cart?.items?.length ?? 0) > 0
  if (!hasItems) {
    return "incomplete"
  }

  if (!cart?.email) {
    return "incomplete"
  }

  if (toMinorUnits(cart?.total) <= 0) {
    return "ready_for_complete"
  }

  const hasPendingSession = (cart?.payment_collection?.payment_sessions ?? []).some(
    (session: any) => session?.status === "pending"
  )

  return hasPendingSession ? "ready_for_complete" : "requires_escalation"
}

const buildDefaultMessages = (cart: any, status: UcpStatus): UcpMessage[] => {
  const messages: UcpMessage[] = []

  if ((cart?.items?.length ?? 0) === 0) {
    messages.push({
      type: "error",
      code: "missing_line_items",
      path: "$.line_items",
      content: "At least one line item is required",
      severity: "recoverable",
    })
  }

  if (!cart?.email) {
    messages.push({
      type: "error",
      code: "missing_buyer_email",
      path: "$.buyer.email",
      content: "Buyer email is required",
      severity: "recoverable",
    })
  }

  if (
    status === "requires_escalation" &&
    toMinorUnits(cart?.total) > 0 &&
    !(cart?.payment_collection?.payment_sessions ?? []).some(
      (session: any) => session?.status === "pending"
    )
  ) {
    messages.push({
      type: "error",
      code: "payment_required",
      path: "$.payment",
      content: "Payment selection requires buyer handoff",
      severity: "requires_buyer_input",
    })
  }

  return messages
}

const mapLineItems = (cart: any) => {
  return (cart?.items ?? []).map((item: any) => {
    const unitPrice = toMinorUnits(item?.unit_price)
    const quantity = Math.max(1, Number(item?.quantity ?? 1))
    const lineSubtotal = unitPrice * quantity

    const mappedItem: Record<string, unknown> = {
      id: item?.variant_id || item?.id,
      title: item?.title || item?.variant_id || item?.id,
      price: unitPrice,
    }

    if (typeof item?.thumbnail === "string" && item.thumbnail.length > 0) {
      mappedItem.image_url = item.thumbnail
    }

    return {
      id: item?.id,
      item: mappedItem,
      quantity,
      totals: [
        { type: "subtotal", amount: lineSubtotal },
        { type: "total", amount: lineSubtotal },
      ],
    }
  })
}

const mapTotals = (cart: any) => {
  return [
    { type: "subtotal", amount: toMinorUnits(cart?.subtotal) },
    { type: "discount", amount: toMinorUnits(cart?.discount_total) },
    { type: "fulfillment", amount: toMinorUnits(cart?.shipping_total) },
    { type: "tax", amount: toMinorUnits(cart?.tax_total) },
    { type: "total", amount: toMinorUnits(cart?.total) },
  ]
}

const mapBuyer = (cart: any) => {
  const firstName =
    cart?.shipping_address?.first_name || cart?.billing_address?.first_name
  const lastName =
    cart?.shipping_address?.last_name || cart?.billing_address?.last_name
  const phone =
    cart?.shipping_address?.phone || cart?.billing_address?.phone || undefined

  const hasBuyer =
    Boolean(cart?.email) || Boolean(firstName) || Boolean(lastName) || Boolean(phone)

  if (!hasBuyer) {
    return undefined
  }

  return {
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    email: cart?.email || undefined,
    phone_number: phone,
  }
}

const mapDeliveryAddress = (cart: any) => {
  const addr = cart?.shipping_address
  if (!addr?.address_1 && !addr?.city && !addr?.country_code) {
    return undefined
  }

  return {
    address_1: addr?.address_1 || undefined,
    address_2: addr?.address_2 || undefined,
    city: addr?.city || undefined,
    province: addr?.province || undefined,
    postal_code: addr?.postal_code || undefined,
    country_code: addr?.country_code || undefined,
    first_name: addr?.first_name || undefined,
    last_name: addr?.last_name || undefined,
    phone: addr?.phone || undefined,
  }
}

const mapShippingMethods = (cart: any) => {
  return (cart?.shipping_methods ?? []).map((method: any) => ({
    id: method?.id,
    shipping_option_id: method?.shipping_option_id,
    amount: toMinorUnits(method?.amount),
  }))
}

const inferInstrumentType = (_providerId: string) => "card"

const mapPaymentInstruments = async (scope: Scope, cart: any) => {
  const sessionInstruments = (cart?.payment_collection?.payment_sessions ?? []).map(
    (session: any) => ({
      id: session?.id,
      handler_id: session?.provider_id,
      type: inferInstrumentType(session?.provider_id),
      selected: session?.status === "pending",
    })
  )

  if (sessionInstruments.length > 0) {
    return sessionInstruments
  }

  const providerIds = await listRegionPaymentProviderIds(scope, cart?.region_id)
  return providerIds.map((providerId, index) => ({
    id: `inst_${index}_${providerId}`,
    handler_id: providerId,
    type: inferInstrumentType(providerId),
    selected: false,
  }))
}

const listRegionPaymentProviderIds = async (
  scope: Scope,
  regionId?: string
): Promise<string[]> => {
  if (!regionId) {
    return []
  }

  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "region_payment_provider",
    variables: {
      filters: {
        region_id: regionId,
      },
    },
    fields: ["payment_provider.id"],
  })

  const rows = asArray<{ payment_provider?: { id?: string } }>(
    await remoteQuery(queryObject)
  )

  return rows
    .map((row) => row?.payment_provider?.id)
    .filter((id): id is string => Boolean(id))
}

const listAllPaymentProviderIds = async (scope: Scope): Promise<string[]> => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "payment_provider",
    fields: ["id"],
  })

  const rows = asArray<{ id?: string }>(await remoteQuery(queryObject))
  return rows
    .map((row) => row?.id)
    .filter((id): id is string => Boolean(id))
}

export const refetchCart = async (scope: Scope, id: string) => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "cart",
    variables: {
      filters: {
        id,
      },
    },
    fields: CHECKOUT_FIELDS,
  })

  const [cart] = asArray<any>(await remoteQuery(queryObject))
  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Checkout session '${id}' was not found`
    )
  }

  return cart
}

const resolveRegionIdByCurrency = async (
  scope: Scope,
  currency: string
): Promise<string> => {
  if (UCP_DEFAULT_REGION_ID) {
    return UCP_DEFAULT_REGION_ID
  }

  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "region",
    variables: {
      filters: {
        currency_code: currency.toLowerCase(),
      },
    },
    fields: ["id", "currency_code"],
  })

  const regions = asArray<{ id?: string }>(await remoteQuery(queryObject))
  const regionId = regions[0]?.id
  if (!regionId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `No region found for currency '${currency}'`
    )
  }

  return regionId
}

const ensurePaymentCollectionId = async (
  scope: Scope,
  cartId: string
): Promise<string> => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const we = scope.resolve(Modules.WORKFLOW_ENGINE)

  const findCollection = async () => {
    const queryObject = remoteQueryObjectFromString({
      entryPoint: "cart_payment_collection",
      variables: {
        filters: {
          cart_id: cartId,
        },
      },
      fields: ["payment_collection.id"],
    })

    const rows = asArray<{ payment_collection?: { id?: string } }>(
      await remoteQuery(queryObject)
    )
    return rows[0]?.payment_collection?.id
  }

  const existing = await findCollection()
  if (existing) {
    return existing
  }

  await we.run(createPaymentCollectionForCartWorkflowId, {
    input: { cart_id: cartId },
  })

  const created = await findCollection()
  if (!created) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Unable to create payment collection for checkout session"
    )
  }

  return created
}

const resolveSelectedProviderId = (
  payment: UcpPaymentInput | undefined,
  providerIds: string[]
): string | undefined => {
  const selectedById =
    payment?.selected_instrument_id &&
    payment?.instruments?.find(
      (instrument) => instrument.id === payment.selected_instrument_id
    )?.handler_id

  if (selectedById) {
    return selectedById
  }

  const selectedFlag = payment?.instruments?.find(
    (instrument) => instrument.selected
  )?.handler_id

  if (selectedFlag) {
    return selectedFlag
  }

  const firstInstrument = payment?.instruments?.[0]?.handler_id
  if (firstInstrument) {
    return firstInstrument
  }

  return providerIds[0]
}

const applyPaymentSelectionIfProvided = async (
  scope: Scope,
  cart: any,
  payment?: UcpPaymentInput
) => {
  const providerIds = await listRegionPaymentProviderIds(scope, cart?.region_id)
  const providerId = resolveSelectedProviderId(payment, providerIds)

  if (!providerId) {
    return cart
  }

  const existingPending = (cart?.payment_collection?.payment_sessions ?? []).find(
    (session: any) =>
      session?.provider_id === providerId && session?.status === "pending"
  )

  if (existingPending) {
    return cart
  }

  const paymentCollectionId =
    cart?.payment_collection?.id ||
    (await ensurePaymentCollectionId(scope, cart.id))

  await createPaymentSessionsWorkflow(scope).run({
    input: {
      payment_collection_id: paymentCollectionId,
      provider_id: providerId,
    },
  })

  return refetchCart(scope, cart.id)
}

const updateCartBuyer = async (
  scope: Scope,
  cartId: string,
  buyer?: UcpCheckoutCreateInput["buyer"]
) => {
  if (!buyer) {
    return
  }

  const hasAnyField = buyer.email || buyer.first_name || buyer.last_name || buyer.phone_number
  if (!hasAnyField) {
    return
  }

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  const updateData: Record<string, unknown> = { id: cartId }

  if (buyer.email) {
    updateData.email = buyer.email
  }

  if (buyer.first_name || buyer.last_name || buyer.phone_number) {
    updateData.shipping_address = {
      first_name: buyer.first_name,
      last_name: buyer.last_name,
      phone: buyer.phone_number,
    }
  }

  await we.run(updateCartWorkflowId, { input: updateData })
}

const applyDeliveryAddress = async (
  scope: Scope,
  cartId: string,
  address?: UcpDeliveryAddressInput
) => {
  if (!address) {
    return
  }

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  await we.run(updateCartWorkflowId, {
    input: {
      id: cartId,
      shipping_address: {
        address_1: address.address_1,
        address_2: address.address_2,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        country_code: address.country_code,
      },
    },
  })
}

const applyDiscountCodes = async (
  scope: Scope,
  cartId: string,
  codes?: string[]
) => {
  if (!codes?.length) {
    return
  }

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  await we.run(updateCartWorkflowId, {
    input: { id: cartId, promo_codes: codes },
  })
}

const applyGiftCards = async (
  scope: Scope,
  cartId: string,
  giftCards?: Array<{ code: string }>
) => {
  if (!giftCards?.length) {
    return
  }

  const codes = giftCards.map((gc) => gc.code)
  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  await we.run(updateCartWorkflowId, {
    input: { id: cartId, promo_codes: codes },
  })
}

const applyShippingOption = async (
  scope: Scope,
  cartId: string,
  shippingOptionId?: string
) => {
  if (!shippingOptionId) {
    return
  }

  await addShippingMethodToCartWorkflow(scope).run({
    input: {
      cart_id: cartId,
      options: [{ id: shippingOptionId }],
    },
  })
}

const applyNotes = async (
  scope: Scope,
  cartId: string,
  notes?: string,
  existingMetadata?: Record<string, unknown>
) => {
  if (notes === undefined) {
    return
  }

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  await we.run(updateCartWorkflowId, {
    input: {
      id: cartId,
      metadata: { ...(existingMetadata ?? {}), ucp_notes: notes },
    },
  })
}

export const listShippingOptionsForCart = async (
  scope: Scope,
  cartId: string
) => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "shipping_option",
    variables: {
      context: { cart_id: cartId },
    },
    fields: ["id", "name", "amount", "provider_id"],
  })

  return asArray<{
    id?: string
    name?: string
    amount?: number
    provider_id?: string
  }>(await remoteQuery(queryObject))
}

const applyExtensions = async (
  scope: Scope,
  cartId: string,
  input: {
    delivery_address?: UcpDeliveryAddressInput
    discount_codes?: string[]
    gift_cards?: Array<{ code: string }>
    shipping_option_id?: string
    notes?: string
  },
  existingMetadata?: Record<string, unknown>
) => {
  await applyDeliveryAddress(scope, cartId, input.delivery_address)
  await applyDiscountCodes(scope, cartId, input.discount_codes)
  await applyGiftCards(scope, cartId, input.gift_cards)
  await applyShippingOption(scope, cartId, input.shipping_option_id)
  await applyNotes(scope, cartId, input.notes, existingMetadata)
}

const replaceCartItems = async (
  scope: Scope,
  cart: any,
  lineItems: UcpCheckoutUpdateInput["line_items"] | UcpCheckoutCreateInput["line_items"]
) => {
  const we = scope.resolve(Modules.WORKFLOW_ENGINE)

  const existingLineItemIds = (cart?.items ?? [])
    .map((item: any) => item?.id)
    .filter((id: string | undefined): id is string => Boolean(id))

  if (existingLineItemIds.length > 0) {
    await we.run(deleteLineItemsWorkflowId, {
      input: {
        cart_id: cart.id,
        ids: existingLineItemIds,
      },
    })
  }

  if (!lineItems?.length) {
    return
  }

  await we.run(addToCartWorkflowId, {
    input: {
      cart_id: cart.id,
      items: lineItems.map((lineItem) => ({
        variant_id: lineItem.item.id,
        quantity: lineItem.quantity,
      })),
    },
  })
}

const mapCompleteWorkflowErrorToMessage = (error: unknown): UcpMessage => {
  if (
    error instanceof MedusaError &&
    (error.type === MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR ||
      error.type === MedusaError.Types.PAYMENT_REQUIRES_MORE_ERROR)
  ) {
    return {
      type: "error",
      code: "payment_failed",
      path: "$.payment",
      content: error.message,
      severity: "requires_buyer_input",
    }
  }

  if (error instanceof MedusaError) {
    return {
      type: "error",
      code: "checkout_error",
      content: error.message,
      severity: "recoverable",
    }
  }

  return {
    type: "error",
    code: "checkout_error",
    content: "Unable to complete checkout session",
    severity: "recoverable",
  }
}

const buildCheckoutResponse = async (
  scope: Scope,
  cart: any,
  options: CheckoutBuildOptions = {}
) => {
  const status = deriveStatus(cart, options.status)
  const providerIds = await listRegionPaymentProviderIds(scope, cart?.region_id)
  const messages =
    options.messages && options.messages.length > 0
      ? options.messages
      : buildDefaultMessages(cart, status)
  const buyer = mapBuyer(cart)
  const deliveryAddress = mapDeliveryAddress(cart)
  const shippingMethods = mapShippingMethods(cart)
  const notes = cart?.metadata?.ucp_notes as string | undefined
  const now = cart?.created_at ? new Date(cart.created_at) : null
  const expiresAt =
    now && Number.isFinite(now.getTime())
      ? new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
      : undefined

  const response: Record<string, unknown> = {
    ucp: buildCheckoutResponseUcp(providerIds),
    id: cart.id,
    line_items: mapLineItems(cart),
    status,
    currency: String(cart?.currency_code || "").toUpperCase(),
    totals: mapTotals(cart),
    links: getDefaultLinks(),
    payment: {
      instruments: await mapPaymentInstruments(scope, cart),
    },
  }

  if (buyer) {
    response.buyer = buyer
  }

  if (deliveryAddress) {
    response.delivery_address = deliveryAddress
  }

  if (shippingMethods.length > 0) {
    response.shipping_methods = shippingMethods
  }

  if (notes) {
    response.notes = notes
  }

  if (messages.length > 0) {
    response.messages = messages
  }

  if (expiresAt && status !== "completed" && status !== "canceled") {
    response.expires_at = expiresAt
  }

  if (status !== "completed" && status !== "canceled") {
    response.continue_url = getContinueUrl(cart.id)
  }

  if (options.order?.id) {
    response.order = {
      id: options.order.id,
      permalink_url: getOrderPermalink(options.order.id),
    }
  }

  return response
}

export const buildBusinessProfile = async (scope: Scope) => {
  const providerIds = await listAllPaymentProviderIds(scope)

  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        [UCP_SERVICE_KEY]: [
          {
            version: UCP_VERSION,
            transport: "rest",
            spec: "https://ucp.dev/specification/checkout-rest",
            schema: "https://ucp.dev/services/shopping/rest.openapi.json",
            endpoint: UCP_REST_ENDPOINT,
          },
          {
            version: UCP_VERSION,
            transport: "mcp",
            spec: "https://ucp.dev/specification/checkout-mcp",
            endpoint: UCP_MCP_ENDPOINT,
          },
        ],
      },
      capabilities: {
        [UCP_CHECKOUT_CAPABILITY_KEY]: [
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/checkout",
            schema: "https://ucp.dev/schemas/shopping/checkout.json",
          },
        ],
        [UCP_FULFILLMENT_CAPABILITY_KEY]: [
          {
            version: UCP_VERSION,
            spec: "https://ucp.dev/specification/fulfillment",
          },
        ],
      },
      payment_handlers: buildPaymentHandlers(providerIds),
    },
  }
}

export const createCheckout = async (
  scope: Scope,
  input: UcpCheckoutCreateInput
) => {
  const regionId = await resolveRegionIdByCurrency(scope, input.currency)

  const { result } = await createCartWorkflow(scope).run({
    input: {
      region_id: regionId,
      email: input.buyer?.email,
      items: input.line_items.map((lineItem) => ({
        variant_id: lineItem.item.id,
        quantity: lineItem.quantity,
      })),
    },
  })

  await updateCartBuyer(scope, result.id, input.buyer)
  await applyExtensions(scope, result.id, input)

  let cart = await refetchCart(scope, result.id)
  cart = await applyPaymentSelectionIfProvided(scope, cart, input.payment)

  return buildCheckoutResponse(scope, cart)
}

export const getCheckout = async (scope: Scope, id: string) => {
  const cart = await refetchCart(scope, id)
  return buildCheckoutResponse(scope, cart)
}

export const updateCheckout = async (
  scope: Scope,
  id: string,
  input: UcpCheckoutUpdateInput
) => {
  const cart = await refetchCart(scope, id)

  if (
    input.currency &&
    cart?.currency_code &&
    input.currency.toLowerCase() !== String(cart.currency_code).toLowerCase()
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Checkout currency cannot be changed once a session is created"
    )
  }

  await replaceCartItems(scope, cart, input.line_items)
  await updateCartBuyer(scope, id, input.buyer)
  await applyExtensions(scope, id, input, cart?.metadata)

  let updatedCart = await refetchCart(scope, id)
  updatedCart = await applyPaymentSelectionIfProvided(
    scope,
    updatedCart,
    input.payment
  )

  return buildCheckoutResponse(scope, updatedCart)
}

export const completeCheckout = async (
  scope: Scope,
  id: string,
  input: UcpCheckoutCompleteInput
) => {
  let cart = await refetchCart(scope, id)
  cart = await applyPaymentSelectionIfProvided(scope, cart, input.payment)

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)
  const { errors, result, transaction } = await we.run(completeCartWorkflowId, {
    input: { id },
    throwOnError: false,
  })

  if (!transaction.hasFinished()) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Checkout session is already being completed by another request"
    )
  }

  if (errors?.[0]) {
    const checkoutAfterError = await refetchCart(scope, id)
    return buildCheckoutResponse(scope, checkoutAfterError, {
      status: "requires_escalation",
      messages: [mapCompleteWorkflowErrorToMessage(errors[0].error)],
    })
  }

  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "order",
    variables: {
      filters: {
        id: result.id,
      },
    },
    fields: ORDER_FIELDS,
  })
  const [order] = asArray<{ id: string }>(await remoteQuery(queryObject))

  const completedCart = await refetchCart(scope, id)
  return buildCheckoutResponse(scope, completedCart, {
    status: "completed",
    order: order ?? { id: result.id },
  })
}

export const cancelCheckout = async (scope: Scope, id: string) => {
  const cart = await refetchCart(scope, id)
  const we = scope.resolve(Modules.WORKFLOW_ENGINE)

  await we.run(updateCartWorkflowId, {
    input: {
      id,
      metadata: {
        ...(cart?.metadata ?? {}),
        ucp_status: "canceled",
        ucp_canceled_at: new Date().toISOString(),
      },
    },
  })

  const canceledCart = await refetchCart(scope, id)
  return buildCheckoutResponse(scope, canceledCart, {
    status: "canceled",
    messages: [
      {
        type: "info",
        code: "checkout_canceled",
        content: "Checkout session was canceled",
      },
    ],
  })
}
