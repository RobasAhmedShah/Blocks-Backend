#set page(paper: "a4", margin: (top: 20mm, right: 15mm, bottom: 20mm, left: 15mm))
#set text(size: 11pt)
#set heading(numbering: none)

// Header
#align(center)[
  #text(size: 32pt, weight: "bold", fill: rgb("#16a34a"))[TRANSACTION CERTIFICATE]
  #v(0.5cm)
  #text(size: 14pt, fill: rgb("#666666"))[Official Proof of Token Purchase]
  #v(0.5cm)
  #line(length: 100%, stroke: 3pt + rgb("#16a34a"))
]

#v(1cm)

// Transaction Information Section
#block(
  fill: rgb("#f9fafb"),
  radius: 6pt,
  padding: 12pt,
)[
  #text(size: 18pt, weight: "bold", fill: rgb("#16a34a"))[Transaction Information]
  #v(0.3cm)
  
  #grid(
    columns: 2,
    column-gutter: 15pt,
    row-gutter: 15pt,
  )[
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[TRANSACTION ID]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= transactionDisplayCode %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[DATE & TIME]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= transactionDate %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[STATUS]
      #v(0.2cm)
      #text(size: 16pt, weight: 600, fill: rgb("#16a34a"))[<%= transactionStatus %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[TYPE]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= transactionType %>]
    ]
  ]
]

#v(0.5cm)

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

// Investment Details Box
#block(
  fill: rgb("#f0fdf4"),
  stroke: 2pt + rgb("#16a34a"),
  radius: 8pt,
  padding: 20pt,
)[
  #text(size: 20pt, weight: "bold", fill: rgb("#16a34a"))[Investment Details]
  #v(0.3cm)
  
  #grid(
    columns: 2,
    column-gutter: 15pt,
    row-gutter: 15pt,
  )[
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[PROPERTY]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= propertyName %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[PROPERTY CODE]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= propertyDisplayCode %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[TOKENS PURCHASED]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[<%= tokensPurchased %>]
    ]
    #block[
      #text(size: 12pt, fill: rgb("#666666"))[TOKEN PRICE]
      #v(0.2cm)
      #text(size: 16pt, weight: 600)[\$<%= tokenPrice %> USDT]
    ]
    #block(column-span: 2)[
      #text(size: 12pt, fill: rgb("#666666"))[TOTAL INVESTMENT AMOUNT]
      #v(0.2cm)
      #text(size: 24pt, weight: "bold", fill: rgb("#16a34a"))[\$<%= totalAmount %> USDT]
    ]
  ]
]

<% if (blockchainHash) { %>
#v(0.5cm)

// Blockchain Verification
#block(
  fill: rgb("#fef3c7"),
  stroke: (left: 4pt + rgb("#f59e0b")),
  radius: 4pt,
  padding: 15pt,
)[
  #text(size: 14pt, weight: "bold", fill: rgb("#92400e"))[Blockchain Verification:]
  #v(0.2cm)
  #text(size: 12pt)[Transaction Hash: #text(font: "mono")[<%= blockchainHash %>]]
  <% if (blockchainNetwork) { %>
  #v(0.1cm)
  #text(size: 12pt)[Network: <%= blockchainNetwork %>]
  <% } %>
  #v(0.2cm)
  #text(size: 12pt)[This transaction has been recorded on the blockchain for permanent verification.]
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
    #text(size: 11pt, fill: rgb("#666666"))[This is an official certificate issued by Blocks Platform]
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
          #text(weight: "bold")[Document Hash:] <%= documentHash ? documentHash.substring(0, 16) + '...' : 'N/A' %> \
          #text(weight: "bold")[Verification:] Valid
        ]
      ]
    ]
  ]
]

