import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"
import type { ToolDefinition, ToolHandler } from "../server"
import { asArray } from "../../ucp/service"

const definition: ToolDefinition = {
  name: "search_shop_catalog",
  description:
    "Search for products from the online store catalog. Returns product titles, descriptions, prices, images, and variant IDs that can be used to add items to a cart.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to match against product titles and descriptions",
      },
      limit: {
        type: "number",
        description: "Maximum number of products to return (default 10, max 50)",
      },
      offset: {
        type: "number",
        description: "Number of products to skip for pagination (default 0)",
      },
    },
    required: ["query"],
  },
}

const handler: ToolHandler = async (params, scope) => {
  const query = String(params.query || "")
  const limit = Math.min(Math.max(1, Number(params.limit) || 10), 50)
  const offset = Math.max(0, Number(params.offset) || 0)

  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "product",
    variables: {
      filters: {
        q: query,
      },
      take: limit,
      skip: offset,
    },
    fields: [
      "id",
      "title",
      "description",
      "handle",
      "thumbnail",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "images.url",
      "collection.id",
      "collection.title",
      "tags.value",
    ],
  })

  const rows = asArray<any>(await remoteQuery(queryObject))

  const products = rows.map((product: any) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    handle: product.handle,
    thumbnail: product.thumbnail,
    variants: (product.variants ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      prices: (v.prices ?? []).map((p: any) => ({
        amount: p.amount,
        currency_code: p.currency_code,
      })),
    })),
    images: (product.images ?? []).map((img: any) => img.url),
    collection: product.collection?.title,
    tags: (product.tags ?? []).map((t: any) => t.value),
  }))

  return {
    products,
    count: products.length,
    has_more: products.length === limit,
  }
}

export const searchCatalogTool = { definition, handler }
