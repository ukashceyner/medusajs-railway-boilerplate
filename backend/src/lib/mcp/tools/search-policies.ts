import type { ToolDefinition, ToolHandler } from "../server"
import {
  UCP_FAQ_URL,
  UCP_PRIVACY_URL,
  UCP_REFUND_URL,
  UCP_SHIPPING_URL,
  UCP_TERMS_URL,
} from "../../constants"

const definition: ToolDefinition = {
  name: "search_shop_policies_and_faqs",
  description:
    "Used to get facts about the store's policies, shipping information, returns, and frequently asked questions. Use this to answer customer questions about store policies.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Optional search query to filter policies and FAQs by topic",
      },
    },
  },
}

const buildPolicies = () => {
  const policies: Array<{
    type: string
    url: string
    summary: string
  }> = []

  policies.push({
    type: "terms_of_service",
    url: UCP_TERMS_URL,
    summary: "Terms and conditions for using our store and purchasing products.",
  })

  policies.push({
    type: "privacy_policy",
    url: UCP_PRIVACY_URL,
    summary:
      "How we collect, use, and protect your personal information.",
  })

  if (UCP_REFUND_URL) {
    policies.push({
      type: "refund_policy",
      url: UCP_REFUND_URL,
      summary:
        "Our refund and return policy, including eligibility and timeframes.",
    })
  }

  if (UCP_SHIPPING_URL) {
    policies.push({
      type: "shipping_policy",
      url: UCP_SHIPPING_URL,
      summary:
        "Shipping methods, delivery timeframes, and shipping costs.",
    })
  }

  return policies
}

const DEFAULT_FAQS = [
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept major credit and debit cards including Visa, Mastercard, and American Express.",
  },
  {
    question: "How long does shipping take?",
    answer:
      "Standard shipping typically takes 3-7 business days. Express shipping options may be available at checkout.",
  },
  {
    question: "What is your return policy?",
    answer:
      "We accept returns within 30 days of purchase for items in original condition. Contact us to initiate a return.",
  },
  {
    question: "How can I track my order?",
    answer:
      "Once your order ships, you will receive a confirmation email with tracking information.",
  },
  {
    question: "Do you offer international shipping?",
    answer:
      "Shipping availability depends on your location. Available shipping options are shown during checkout.",
  },
]

const handler: ToolHandler = async (params, _scope) => {
  const query = String(params.query || "").toLowerCase()
  const policies = buildPolicies()
  let faqs = DEFAULT_FAQS

  if (query) {
    faqs = faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
    )
  }

  return {
    policies,
    faqs,
    faq_url: UCP_FAQ_URL || undefined,
  }
}

export const searchPoliciesTool = { definition, handler }
