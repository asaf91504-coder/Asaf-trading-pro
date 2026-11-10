// Local UI catalogs only. Never translate or transmit user or provider data.
export const interfaceLocales = {
  "he": {
    "name": "עברית",
    "direction": "rtl",
    "messages": {
      "charts": "גרפים",
      "scanner": "סורק מניות",
      "news": "חדשות",
      "chat": "ASAF AI",
      "risk": "מחשבון סיכון",
      "watch": "מעקב",
      "community": "קהילה",
      "journal": "יומן מסחר",
      "language": "שפת ממשק"
    }
  },
  "en": {
    "name": "English",
    "direction": "ltr",
    "messages": {
      "charts": "Charts",
      "scanner": "Stock screener",
      "news": "News",
      "chat": "ASAF AI",
      "risk": "Risk calculator",
      "watch": "Watchlist",
      "community": "Community",
      "journal": "Trading journal",
      "language": "Interface language"
    }
  },
  "es": {
    "name": "Español",
    "direction": "ltr",
    "messages": {
      "charts": "Gráficos",
      "scanner": "Buscador de acciones",
      "news": "Noticias",
      "chat": "ASAF AI",
      "risk": "Calculadora de riesgo",
      "watch": "Lista de seguimiento",
      "community": "Comunidad",
      "journal": "Diario de trading",
      "language": "Idioma de la interfaz"
    }
  },
  "ar": {
    "name": "العربية",
    "direction": "rtl",
    "messages": {
      "charts": "الرسوم البيانية",
      "scanner": "ماسح الأسهم",
      "news": "الأخبار",
      "chat": "ASAF AI",
      "risk": "حاسبة المخاطر",
      "watch": "قائمة المتابعة",
      "community": "المجتمع",
      "journal": "سجل التداول",
      "language": "لغة الواجهة"
    }
  },
  "fr": {
    "name": "Français",
    "direction": "ltr",
    "messages": {
      "charts": "Graphiques",
      "scanner": "Sélecteur d’actions",
      "news": "Actualités",
      "chat": "ASAF AI",
      "risk": "Calculateur de risque",
      "watch": "Liste de suivi",
      "community": "Communauté",
      "journal": "Journal de trading",
      "language": "Langue de l’interface"
    }
  },
  "de": {
    "name": "Deutsch",
    "direction": "ltr",
    "messages": {
      "charts": "Charts",
      "scanner": "Aktienfilter",
      "news": "Nachrichten",
      "chat": "ASAF AI",
      "risk": "Risikorechner",
      "watch": "Beobachtungsliste",
      "community": "Community",
      "journal": "Handelstagebuch",
      "language": "Sprache der Benutzeroberfläche"
    }
  },
  "pt": {
    "name": "Português",
    "direction": "ltr",
    "messages": {
      "charts": "Gráficos",
      "scanner": "Filtro de ações",
      "news": "Notícias",
      "chat": "ASAF AI",
      "risk": "Calculadora de risco",
      "watch": "Lista de acompanhamento",
      "community": "Comunidade",
      "journal": "Diário de negociação",
      "language": "Idioma da interface"
    }
  },
  "ru": {
    "name": "Русский",
    "direction": "ltr",
    "messages": {
      "charts": "Графики",
      "scanner": "Скринер акций",
      "news": "Новости",
      "chat": "ASAF AI",
      "risk": "Калькулятор риска",
      "watch": "Список наблюдения",
      "community": "Сообщество",
      "journal": "Торговый журнал",
      "language": "Язык интерфейса"
    }
  },
  "zh": {
    "name": "中文",
    "direction": "ltr",
    "messages": {
      "charts": "图表",
      "scanner": "股票筛选器",
      "news": "新闻",
      "chat": "ASAF AI",
      "risk": "风险计算器",
      "watch": "自选列表",
      "community": "社区",
      "journal": "交易日志",
      "language": "界面语言"
    }
  },
  "ja": {
    "name": "日本語",
    "direction": "ltr",
    "messages": {
      "charts": "チャート",
      "scanner": "株式スクリーナー",
      "news": "ニュース",
      "chat": "ASAF AI",
      "risk": "リスク計算機",
      "watch": "ウォッチリスト",
      "community": "コミュニティ",
      "journal": "取引日誌",
      "language": "表示言語"
    }
  }
};
export function resolveInterfaceLocale(value){
 const code=String(value||"he").toLowerCase().split(/[-_]/)[0];
 return Object.hasOwn(interfaceLocales,code)?code:"he";
}
export function interfaceText(locale,key){
 const code=resolveInterfaceLocale(locale);
 return interfaceLocales[code].messages[key]??interfaceLocales.he.messages[key]??key;
}
