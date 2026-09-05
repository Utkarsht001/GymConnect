import React, { createContext, useContext, useState } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rate: number; // Conversion multiplier relative to base INR (1.0)
}

export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', rate: 1.0 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)', rate: 0.012 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)', rate: 0.011 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)', rate: 0.0093 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham (AED)', rate: 0.044 }
};

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  currencyConfig: CurrencyConfig;
  formatPrice: (amountInRupees: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('fit_currency');
    return (saved && CURRENCY_CONFIGS[saved as CurrencyCode]) ? (saved as CurrencyCode) : 'INR';
  });

  const setCurrency = (code: CurrencyCode) => {
    if (CURRENCY_CONFIGS[code]) {
      setCurrencyState(code);
      localStorage.setItem('fit_currency', code);
    }
  };

  const currencyConfig = CURRENCY_CONFIGS[currency];

  const formatPrice = (amountInRupees: number): string => {
    if (isNaN(amountInRupees) || amountInRupees === null || amountInRupees === undefined) {
      return `${currencyConfig.symbol}0`;
    }
    const converted = amountInRupees * currencyConfig.rate;

    if (currency === 'INR') {
      return `${currencyConfig.symbol}${Math.round(converted).toLocaleString('en-IN')}`;
    }

    return `${currencyConfig.symbol}${converted.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencyConfig, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
