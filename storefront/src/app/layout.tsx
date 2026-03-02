import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

const serializeJsonLd = (data: Record<string, unknown>) =>
  JSON.stringify(data).replace(/</g, "\\u003c")

export default function RootLayout(props: { children: React.ReactNode }) {
  const baseUrl = getBaseURL()

  const globalJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Medusa Store",
        url: baseUrl,
      },
      {
        "@type": "Organization",
        name: "Medusa Store",
        url: baseUrl,
        logo: `${baseUrl}/opengraph-image.jpg`,
      },
    ],
  }

  return (
    <html lang="en" data-mode="light">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(globalJsonLd),
          }}
        />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
