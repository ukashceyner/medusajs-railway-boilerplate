import { registerTool } from "../server"
import { searchCatalogTool } from "./search-catalog"
import { getProductDetailsTool } from "./get-product-details"
import { createCartTool } from "./create-cart"
import { getCartTool } from "./get-cart"
import { updateCartTool } from "./update-cart"
import { searchPoliciesTool } from "./search-policies"

let registered = false

export function registerAllTools() {
  if (registered) {
    return
  }

  registerTool(
    searchCatalogTool.definition.name,
    searchCatalogTool.definition,
    searchCatalogTool.handler
  )
  registerTool(
    getProductDetailsTool.definition.name,
    getProductDetailsTool.definition,
    getProductDetailsTool.handler
  )
  registerTool(
    createCartTool.definition.name,
    createCartTool.definition,
    createCartTool.handler
  )
  registerTool(
    getCartTool.definition.name,
    getCartTool.definition,
    getCartTool.handler
  )
  registerTool(
    updateCartTool.definition.name,
    updateCartTool.definition,
    updateCartTool.handler
  )
  registerTool(
    searchPoliciesTool.definition.name,
    searchPoliciesTool.definition,
    searchPoliciesTool.handler
  )

  registered = true
}
