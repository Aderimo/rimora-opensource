/**
 * iyzipay TypeScript Type Declarations
 * 
 * Bu dosya iyzipay npm paketi için tip tanımlamalarını içerir.
 * Paket resmi TypeScript desteği sunmadığı için manuel tanımlama gereklidir.
 */

declare module 'iyzipay' {
  interface IyzipayOptions {
    apiKey: string
    secretKey: string
    uri: string
  }

  interface Buyer {
    id: string
    name: string
    surname: string
    gsmNumber: string
    email: string
    identityNumber: string
    lastLoginDate?: string
    registrationDate?: string
    registrationAddress?: string
    ip: string
    city: string
    country: string
    zipCode?: string
  }

  interface Address {
    contactName: string
    city: string
    country: string
    address: string
    zipCode?: string
  }

  interface BasketItem {
    id: string
    name: string
    category1: string
    category2?: string
    itemType: string
    price: string
  }

  interface CheckoutFormInitializeRequest {
    locale: string
    conversationId: string
    price: string
    paidPrice: string
    currency: string
    basketId: string
    paymentGroup: string
    callbackUrl: string
    enabledInstallments: number[]
    buyer: Buyer
    shippingAddress: Address
    billingAddress: Address
    basketItems: BasketItem[]
  }

  interface CheckoutFormInitializeResult {
    status: string
    locale: string
    systemTime: number
    conversationId: string
    token?: string
    checkoutFormContent?: string
    paymentPageUrl?: string
    errorCode?: string
    errorMessage?: string
    errorGroup?: string
  }

  interface CheckoutFormRetrieveRequest {
    locale: string
    token: string
  }

  interface CheckoutFormRetrieveResult {
    status: string
    locale: string
    systemTime: number
    conversationId: string
    paymentId?: string
    paymentStatus?: string
    price?: string
    paidPrice?: string
    currency?: string
    basketId?: string
    basketItems?: BasketItem[]
    errorCode?: string
    errorMessage?: string
    errorGroup?: string
  }

  interface SubscriptionCancelRequest {
    locale: string
    subscriptionReferenceCode: string
  }

  interface SubscriptionCancelResult {
    status: string
    locale: string
    systemTime: number
    errorCode?: string
    errorMessage?: string
    errorGroup?: string
  }

  interface RefundCreateRequest {
    locale: string
    conversationId: string
    paymentTransactionId: string
    price: string
    ip: string
    currency?: string
  }

  interface RefundCreateResult {
    status: string
    locale: string
    systemTime: number
    conversationId: string
    paymentId?: string
    paymentStatus?: string
    price?: string
    currency?: string
    errorCode?: string
    errorMessage?: string
    errorGroup?: string
  }

  class Iyzipay {
    constructor(options: IyzipayOptions)

    checkoutFormInitialize: {
      create(
        request: CheckoutFormInitializeRequest,
        callback: (err: Error | null, result: CheckoutFormInitializeResult) => void
      ): void
    }

    checkoutForm: {
      retrieve(
        request: CheckoutFormRetrieveRequest,
        callback: (err: Error | null, result: CheckoutFormRetrieveResult) => void
      ): void
    }

    subscription: {
      cancel(
        request: SubscriptionCancelRequest,
        callback: (err: Error | null, result: SubscriptionCancelResult) => void
      ): void
    }

    refund: {
      create(
        request: RefundCreateRequest,
        callback: (err: Error | null, result: RefundCreateResult) => void
      ): void
    }

    static LOCALE: {
      TR: string
      EN: string
    }

    static CURRENCY: {
      TRY: string
      EUR: string
      USD: string
      GBP: string
      IRR: string
      NOK: string
      RUB: string
      CHF: string
    }

    static PAYMENT_GROUP: {
      PRODUCT: string
      LISTING: string
      SUBSCRIPTION: string
    }

    static BASKET_ITEM_TYPE: {
      PHYSICAL: string
      VIRTUAL: string
    }

    static PAYMENT_CHANNEL: {
      WEB: string
      MOBILE: string
      MOBILE_WEB: string
      MOBILE_IOS: string
      MOBILE_ANDROID: string
      MOBILE_WINDOWS: string
      MOBILE_TABLET: string
      MOBILE_PHONE: string
    }
  }

  export = Iyzipay
}
