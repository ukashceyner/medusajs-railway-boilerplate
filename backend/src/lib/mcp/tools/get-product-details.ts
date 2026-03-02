import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"
import type { ToolDefinition, ToolHandler } from "../server"
import { asArray } from "../../ucp/service"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "thumbnail",
  "status",
  "images.id",
  "images.url",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.options.value",
  "variants.options.option.title",
  "options.id",
  "options.title",
  "options.values.value",
  "collection.id",
  "collection.title",
  "categories.id",
  "categories.name",
  "tags.id",
  "tags.value",
  "weight",
  "length",
  "height",
  "width",
  "metadata",
]

const definition: ToolDefinition = {
  name: "get_product_details",
  description:
    "Look up a product by ID and return full details including all variants, options, pricing, images, and inventory information. Use variant IDs from the response to add items to a cart.",
  inputSchema: {
    type: "object",
    properties: {
      product_id: {
        type: "string",
        description: "The product ID or handle to look up",
      },
    },
    required: ["product_id"],
  },
}

const handler: ToolHandler = async (params, scope) => {
  const productId = String(params.product_id || "")
  if (!productId) {
    throw new Error("product_id is required")
  }

  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

  // Try by ID first
  const byIdQuery = remoteQueryObjectFromString({
    entryPoint: "product",
    variables: {
      filters: { id: productId },
    },
    fields: PRODUCT_FIELDS,
  })

  let rows = asArray<any>(await remoteQuery(byIdQuery))

  // Fall back to handle
  if (rows.length === 0) {
    const byHandleQuery = remoteQueryObjectFromString({
      entryPoint: "product",
      variables: {
        filters: { handle: productId },
      },
      fields: PRODUCT_FIELDS,
    })
    rows = asArray<any>(await remoteQuery(byHandleQuery))
  }

  if (rows.length === 0) {
    throw new Error(`Product not found: ${productId}`)
  }

  const product = rows[0]

  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    handle: product.handle,
    thumbnail: product.thumbnail,
    status: product.status,
    images: (product.images ?? []).map((img: any) => ({
      id: img.id,
      url: img.url,
    })),
    variants: (product.variants ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      prices: (v.prices ?? []).map((p: any) => ({
        amount: p.amount,
        currency_code: p.currency_code,
      })),
      options: (v.options ?? []).map((o: any) => ({
        name: o.option?.title,
        value: o.value,
      })),
    })),
    options: (product.options ?? []).map((o: any) => ({
      id: o.id,
      title: o.title,
      values: (o.values ?? []).map((v: any) => v.value),
    })),
    collection: product.collection
      ? { id: product.collection.id, title: product.collection.title }
      : null,
    categories: (product.categories ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
    })),
    tags: (product.tags ?? []).map((t: any) => t.value),
    dimensions: {
      weight: product.weight,
      length: product.length,
      height: product.height,
      width: product.width,
    },
    metadata: product.metadata,
  }
}

export const getProductDetailsTool = { definition, handler }
