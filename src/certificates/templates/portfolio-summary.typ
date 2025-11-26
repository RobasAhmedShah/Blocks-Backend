#set page(paper: "a4", margin: (top: 20mm, right: 15mm, bottom: 20mm, left: 15mm))
#set text(size: 11pt)
#set heading(numbering: none)

// Header
#align(center)[
  #text(size: 32pt, weight: "bold", fill: rgb("#16a34a"))[PORTFOLIO SUMMARY CERTIFICATE]
  #v(0.5cm)
  #text(size: 14pt, fill: rgb("#666666"))[Complete Investment Portfolio for Property]
  #v(0.5cm)
  #line(length: 100%, stroke: 3pt + rgb("#16a34a"))
]

#v(1cm)

// Investor Information Section
#block(
  fill: rgb("#f9fafb"),
  radius: 6pt,
  padding: 12pt,
)[
  #text(size: 18pt, weight: "bold", fill: rgb("#16a34a"))[Investor Information]
  #v(0.3cm)
  
  #grid(
    columns: 2,
    column-gutter: 15pt,
    row-gutter: 15pt,
  )[
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[INVESTOR NAME]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= investorName %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[USER ID]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= userId %>]
    ]
  ]
]

#v(0.5cm)

// Property Information Section
#block(
  fill: rgb("#f9fafb"),
  radius: 6pt,
  padding: 12pt,
)[
  #text(size: 18pt, weight: "bold", fill: rgb("#16a34a"))[Property Information]
  #v(0.3cm)
  
  #grid(
    columns: 2,
    column-gutter: 15pt,
    row-gutter: 15pt,
  )[
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[PROPERTY NAME]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= propertyName %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[PROPERTY CODE]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= propertyDisplayCode %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[LOCATION]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= propertyLocation %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[EXPECTED ROI]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= expectedROI %>%]
    ]
  ]
]

#v(0.5cm)

// Portfolio Summary Box
#block(
  fill: rgb("#f0fdf4"),
  stroke: 2pt + rgb("#16a34a"),
  radius: 8pt,
  padding: 25pt,
)[
  #text(size: 20pt, weight: "bold", fill: rgb("#16a34a"))[Portfolio Summary]
  #v(0.3cm)
  
  #grid(
    columns: 2,
    column-gutter: 20pt,
    row-gutter: 20pt,
  )[
    #block(align: center)[
      #text(size: 12pt, fill: rgb("#666666"))[TOTAL TOKENS OWNED]
      #v(0.2cm)
      #text(size: 24pt, weight: "bold", fill: rgb("#16a34a"))[<%= totalTokens %>]
    ]
    #block(align: center)[
      #text(size: 12pt, fill: rgb("#666666"))[TOTAL INVESTED]
      #v(0.2cm)
      #text(size: 24pt, weight: "bold", fill: rgb("#16a34a"))[\$<%= totalInvested %> USDT]
    ]
    #block(align: center)[
      #text(size: 12pt, fill: rgb("#666666"))[AVERAGE PRICE]
      #v(0.2cm)
      #text(size: 24pt, weight: "bold", fill: rgb("#16a34a"))[\$<%= averagePrice %> USDT]
    ]
    #block(align: center)[
      #text(size: 12pt, fill: rgb("#666666"))[OWNERSHIP %]
      #v(0.2cm)
      #text(size: 24pt, weight: "bold", fill: rgb("#16a34a"))[<%= ownershipPercentage %>%]
    ]
  ]
]

<% if (transactions && transactions.length > 0) { %>
#v(0.5cm)

// Transaction History Section
#block[
  #text(size: 18pt, weight: "bold", fill: rgb("#16a34a"))[Transaction History]
  #v(0.3cm)
  
  #table(
    columns: 5,
    stroke: none,
    align: center,
    [*Date*][*Transaction ID*][*Tokens*][*Amount*][*Status*],
    <% transactions.forEach(function(txn) { %>
    [<%= txn.date %>][<%= txn.displayCode %>][<%= txn.tokens %>][\$<%= txn.amount %> USDT][#text(fill: rgb("#16a34a"))[<%= txn.status %>]],
    <% }); %>
  )
]
<% } %>

#pagebreak()

// Stamps Section
#v(2cm)
#align(center)[
  <% if (secpStampUrl) { %>
  #image("secp.png", width: 120pt)
  #h(40pt)
  <% } %>
  <% if (sbpStampUrl) { %>
  #image("sbp.png", width: 120pt)
  <% } %>
]

#v(2cm)

// Footer
#block(
  stroke: (top: 1pt + rgb("#e5e7eb")),
  padding: (top: 20pt),
)[
  #align(center)[
    #text(size: 11pt, fill: rgb("#666666"))[This is an official portfolio summary certificate issued by Blocks Platform]
    #v(0.3cm)
    #grid(
      columns: 2,
      column-gutter: 20pt,
    )[
      #block[
        #text(size: 11pt, fill: rgb("#666666"))[
          #text(weight: "bold")[Certificate ID:] <%= certificateId %> \
          #text(weight: "bold")[Generated:] <%= generatedAt %>
        ]
      ]
      #block(align: right)[
        #text(size: 11pt, fill: rgb("#666666"))[
          #text(weight: "bold")[Property:] <%= propertyDisplayCode %> \
          #text(weight: "bold")[Verification:] Valid
        ]
      ]
    ]
  ]
]

