# System Architecture – Universal Cart

## High‑level Diagram

```mermaid
graph TB
    subgraph Clients
        Web[Next.js Web App]
        Mobile[Flutter Mobile]
        Extension[Browser Extension]
    end

    subgraph Gateway
        API[API Gateway / Load Balancer]
    end

    subgraph Backend Services
        Cart[Cart Service]
        Matching[Matching Engine]
        Pricing[Pricing Service]
        Split[Split Optimizer]
        AutoBuy[Auto‑Buy Scheduler]
        VirtualCard[Virtual Card Issuer]
    end

    subgraph Integrations
        RetailerAdapters[Retailer Adapters]
        Scrapers[Web Scrapers]
    end

    subgraph Data Stores
        Postgres[(PostgreSQL)]
        Redis[(Redis Cache)]
        S3[(S3 / Blob Storage)]
    end

    subgraph External
        RetailerAPIs[Retailer APIs]
        Stripe[Stripe Issuing]
    end

    Clients --> API
    API --> Cart
    API --> Matching
    API --> Pricing
    API --> Split
    API --> AutoBuy
    API --> VirtualCard

    Cart --> Postgres
    Cart --> Redis
    Matching --> Postgres
    Matching --> S3
    Split --> Postgres
    AutoBuy --> Redis

    Matching --> RetailerAdapters
    Pricing --> RetailerAdapters
    VirtualCard --> Stripe
    RetailerAdapters --> Scrapers
    RetailerAdapters --> RetailerAPIs