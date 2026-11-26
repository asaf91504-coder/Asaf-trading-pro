// Accessibility claims are scoped to the actual chart presentation mode.
const source=[
  "כאשר מופעל גרף Canvas מקומי ונטענים נתוני נרות מורשים, זמינים תיאור טקסט, טבלה של עד 200 נרות מהטווח המוצג וכלי ציור לפי תאריך ומחיר. האפשרויות אינן זמינות בכל מצב תצוגה.",
  "במצב תמונת שרת של Twelve Data מוצגים תמונה, סימול, טווח נרות ותאריך הנר האחרון. אין במצב זה טבלת נרות מקוריים, זום או גלילה בתוך הגרף או ציור ידני. ניתוח וסימונים מתבצעים דרך הצ׳אט, בכפוף לנתונים ולהרשאות. פתיחת גרף מהסורק מוסיפה סימונים אוטומטיים ומקרא, וניתן לפתוח תמונה רחבה עם גלילה אופקית.",
  "Tab ו־Shift+Tab עוברים בין פעולות; Enter או רווח מפעילים כפתור. בלשוניות: חצים ימינה ושמאלה מחליפים לשונית, Home ו־End עוברים לקצוות. Escape סוגר חלונות ותפריטים נתמכים כאשר המיקוד בתוכם.",
  "בגרף Canvas מקומי עם נתונים טעונים: חצים מזיזים את הטווח, + ו־− משנים זום ו־Home חוזר לנרות האחרונים. קיצורים אלה אינם פעילים בתמונת השרת של Twelve Data.",
  "הגרף עשוי להיות Canvas מקומי או תמונת שרת, בהתאם לחיבור. תיאור טקסט או טקסט חלופי לתמונה אינם תחליף מלא לכל נר, קו או תבנית. הגדלת טקסט וניגודיות משנות את הממשק, אך אינן משנות בהכרח את תוכן הגרף או התמונה. טבלאות רחבות עשויות לדרוש גלילה אופקית."
];
const rows={
  "en": [
    "When a local Canvas chart is active and permitted candle data is loaded, a text description, a table of up to 200 candles from the visible range, and drawing tools using dates and prices are available. These options are not available in every display mode.",
    "Twelve Data server-image mode shows an image, symbol, candle interval and latest candle date. This mode has no raw candle table, in-chart zoom or panning, or manual drawing. Analysis and annotations use the chat, subject to available data and permissions. Opening a chart from the screener adds automatic marks and a legend; a wide image with horizontal scrolling is available.",
    "Tab and Shift+Tab move between controls; Enter or Space activates a button. In tabs, Left and Right arrows switch tabs, and Home and End move to the first and last tabs. Escape closes supported dialogs and menus when focus is inside them.",
    "In a local Canvas chart with loaded data, arrows move the visible range, + and − change zoom, and Home returns to the latest candles. These shortcuts do not operate on Twelve Data server images.",
    "The chart may use local Canvas or a server image, depending on the connection. A text description or image alternative text does not fully represent every candle, line or pattern. Text-size and contrast settings change the interface but do not necessarily change the chart or image content. Wide tables may require horizontal scrolling."
  ],
  "es": [
    "Cuando está activo un gráfico Canvas local y se han cargado datos de velas permitidos, hay una descripción textual, una tabla de hasta 200 velas del rango visible y herramientas de dibujo mediante fecha y precio. Estas opciones no están disponibles en todos los modos de visualización.",
    "El modo de imagen del servidor de Twelve Data muestra una imagen, el símbolo, el intervalo de las velas y la fecha de la última vela. No ofrece tabla de velas originales, zoom o desplazamiento dentro del gráfico ni dibujo manual. El análisis y las anotaciones se realizan por chat, según los datos y permisos disponibles. Al abrir un gráfico desde el escáner se añaden marcas automáticas y una leyenda; hay una imagen amplia con desplazamiento horizontal.",
    "Tab y Shift+Tab recorren los controles; Enter o Espacio activa un botón. En las pestañas, las flechas izquierda y derecha cambian de pestaña y Home y End van a la primera y la última. Escape cierra los diálogos y menús compatibles cuando tienen el foco.",
    "En un gráfico Canvas local con datos cargados, las flechas desplazan el rango visible, + y − cambian el zoom y Home vuelve a las últimas velas. Estos atajos no funcionan en las imágenes del servidor de Twelve Data.",
    "El gráfico puede usar Canvas local o una imagen del servidor, según la conexión. Una descripción textual o el texto alternativo de una imagen no representa por completo cada vela, línea o patrón. Los ajustes de tamaño de texto y contraste cambian la interfaz, pero no necesariamente el contenido del gráfico o la imagen. Las tablas anchas pueden requerir desplazamiento horizontal."
  ],
  "fr": [
    "Lorsqu’un graphique Canvas local est actif et que des données de bougies autorisées sont chargées, une description textuelle, un tableau de 200 bougies au maximum de la plage visible et des outils de dessin par date et prix sont disponibles. Ces options ne sont pas présentes dans tous les modes d’affichage.",
    "Le mode image serveur de Twelve Data affiche une image, le symbole, l’intervalle des bougies et la date de la dernière bougie. Il ne propose ni tableau de bougies brutes, ni zoom ou défilement dans le graphique, ni dessin manuel. L’analyse et les annotations passent par le chat, selon les données et autorisations disponibles. Ouvrir un graphique depuis le scanner ajoute des annotations automatiques et une légende ; une image élargie avec défilement horizontal est disponible.",
    "Tab et Shift+Tab parcourent les commandes ; Entrée ou Espace active un bouton. Dans les onglets, les flèches gauche et droite changent d’onglet, et Home et End vont au premier et au dernier. Échap ferme les fenêtres et menus compatibles lorsque le focus s’y trouve.",
    "Dans un graphique Canvas local avec des données chargées, les flèches déplacent la plage visible, + et − modifient le zoom et Home revient aux dernières bougies. Ces raccourcis ne fonctionnent pas sur les images serveur de Twelve Data.",
    "Le graphique peut utiliser un Canvas local ou une image serveur, selon la connexion. Une description textuelle ou le texte alternatif d’une image ne représente pas entièrement chaque bougie, ligne ou figure. Les réglages de taille du texte et de contraste modifient l’interface, mais pas nécessairement le contenu du graphique ou de l’image. Les tableaux larges peuvent nécessiter un défilement horizontal."
  ],
  "de": [
    "Wenn ein lokales Canvas-Diagramm aktiv ist und zulässige Kerzendaten geladen sind, stehen eine Textbeschreibung, eine Tabelle mit bis zu 200 Kerzen aus dem sichtbaren Bereich und Zeichenwerkzeuge anhand von Datum und Preis zur Verfügung. Diese Funktionen sind nicht in jedem Anzeigemodus verfügbar.",
    "Der Serverbildmodus von Twelve Data zeigt ein Bild, das Symbol, das Kerzenintervall und das Datum der letzten Kerze. Dieser Modus bietet keine Rohdatentabelle der Kerzen, keinen Zoom oder Bildlauf innerhalb des Diagramms und kein manuelles Zeichnen. Analysen und Markierungen erfolgen über den Chat, abhängig von Daten und Berechtigungen. Ein Chart aus dem Screener enthält automatische Markierungen und eine Legende; eine breite Bildansicht mit horizontalem Scrollen ist verfügbar.",
    "Tab und Shift+Tab wechseln zwischen Bedienelementen; Enter oder die Leertaste aktiviert eine Schaltfläche. Bei Registerkarten wechseln die Pfeiltasten links und rechts die Registerkarte; Home und End führen zur ersten bzw. letzten. Escape schließt unterstützte Dialoge und Menüs, wenn der Fokus darin liegt.",
    "In einem lokalen Canvas-Diagramm mit geladenen Daten verschieben Pfeiltasten den sichtbaren Bereich, + und − ändern den Zoom und Home führt zu den neuesten Kerzen. Diese Tastenkürzel funktionieren nicht bei Serverbildern von Twelve Data.",
    "Je nach Verbindung verwendet das Diagramm lokales Canvas oder ein Serverbild. Eine Textbeschreibung oder ein Alternativtext bildet nicht jede Kerze, Linie oder Formation vollständig ab. Textgröße und Kontrast ändern die Oberfläche, aber nicht unbedingt den Inhalt des Diagramms oder Bildes. Breite Tabellen können horizontales Scrollen erfordern."
  ],
  "pt": [
    "Quando um gráfico Canvas local está ativo e os dados de velas permitidos estão carregados, estão disponíveis uma descrição textual, uma tabela de até 200 velas do intervalo visível e ferramentas de desenho por data e preço. Essas opções não estão disponíveis em todos os modos de exibição.",
    "O modo de imagem do servidor da Twelve Data mostra uma imagem, o símbolo, o intervalo das velas e a data da última vela. Esse modo não oferece tabela de velas originais, zoom ou deslocamento dentro do gráfico, nem desenho manual. Análises e marcações são feitas pelo chat, conforme os dados e as permissões disponíveis. Abrir um gráfico no scanner adiciona marcações automáticas e uma legenda; está disponível uma imagem ampla com deslocamento horizontal.",
    "Tab e Shift+Tab percorrem os controles; Enter ou Espaço ativa um botão. Nas abas, as setas esquerda e direita alternam entre abas, e Home e End vão à primeira e à última. Escape fecha janelas e menus compatíveis quando o foco está dentro deles.",
    "Em um gráfico Canvas local com dados carregados, as setas movem o intervalo visível, + e − alteram o zoom e Home retorna às velas mais recentes. Esses atalhos não funcionam nas imagens do servidor da Twelve Data.",
    "O gráfico pode usar Canvas local ou uma imagem do servidor, conforme a conexão. Uma descrição textual ou o texto alternativo de uma imagem não representa por completo cada vela, linha ou padrão. O tamanho do texto e o contraste alteram a interface, mas não necessariamente o conteúdo do gráfico ou da imagem. Tabelas largas podem exigir rolagem horizontal."
  ],
  "ru": [
    "Когда активен локальный график Canvas и загружены разрешённые данные свечей, доступны текстовое описание, таблица до 200 свечей из видимого диапазона и инструменты рисования по дате и цене. Эти возможности доступны не во всех режимах отображения.",
    "В режиме серверного изображения Twelve Data показаны изображение, тикер, интервал свечей и дата последней свечи. В этом режиме нет таблицы исходных свечей, масштабирования или прокрутки внутри графика и ручного рисования. Анализ и разметка выполняются через чат с учётом доступных данных и разрешений. График из сканера содержит автоматические отметки и легенду; доступен широкий вид изображения с горизонтальной прокруткой.",
    "Tab и Shift+Tab перемещают фокус между элементами; Enter или пробел активирует кнопку. На вкладках стрелки влево и вправо переключают вкладку, а Home и End переходят к первой и последней. Escape закрывает поддерживаемые окна и меню, если фокус находится внутри них.",
    "На локальном графике Canvas с загруженными данными стрелки сдвигают видимый диапазон, + и − меняют масштаб, а Home возвращает к последним свечам. Эти сочетания клавиш не работают с серверными изображениями Twelve Data.",
    "В зависимости от подключения график может использовать локальный Canvas или серверное изображение. Текстовое описание или альтернативный текст изображения не передаёт полностью каждую свечу, линию или фигуру. Размер текста и контраст изменяют интерфейс, но не обязательно содержимое графика или изображения. Широким таблицам может потребоваться горизонтальная прокрутка."
  ],
  "ar": [
    "عند تفعيل رسم Canvas محلي وتحميل بيانات شموع مسموح بها، يتوفر وصف نصي وجدول يضم حتى 200 شمعة من النطاق الظاهر وأدوات رسم حسب التاريخ والسعر. هذه الخيارات غير متاحة في جميع أوضاع العرض.",
    "يعرض وضع صورة الخادم من Twelve Data صورةً ورمز الأصل والفاصل الزمني للشموع وتاريخ آخر شمعة. لا يتضمن هذا الوضع جدول بيانات الشموع الأصلية أو التكبير والتنقل داخل الرسم أو الرسم اليدوي. يتم التحليل ووضع العلامات عبر الدردشة وفق البيانات والصلاحيات المتاحة. يضيف فتح الرسم من الماسح علامات تلقائية ومفتاح ألوان، ويمكن عرض صورة واسعة مع تمرير أفقي.",
    "ينقل Tab وShift+Tab التركيز بين عناصر التحكم؛ ويشغّل Enter أو مفتاح المسافة الزر. في علامات التبويب، يبدّل السهمان الأيمن والأيسر التبويب، وينتقل Home وEnd إلى الأول والأخير. يغلق Escape النوافذ والقوائم المدعومة عندما يكون التركيز داخلها.",
    "في رسم Canvas محلي مع بيانات محمّلة، تحرك الأسهم النطاق الظاهر، ويغيّر + و− التكبير، ويعيد Home العرض إلى أحدث الشموع. لا تعمل هذه الاختصارات على صور خادم Twelve Data.",
    "قد يستخدم الرسم Canvas محليًا أو صورة من الخادم حسب الاتصال. لا يمثّل الوصف النصي أو النص البديل للصورة كل شمعة أو خط أو نمط تمثيلًا كاملًا. تغيّر إعدادات حجم النص والتباين الواجهة، لكنها لا تغيّر بالضرورة محتوى الرسم أو الصورة. قد تتطلب الجداول العريضة تمريرًا أفقيًا."
  ],
  "zh": [
    "启用本地 Canvas 图表并加载获准使用的蜡烛数据后，可使用文字说明、最多包含可见范围内 200 根蜡烛的数据表，以及按日期和价格绘图的工具。这些功能并非在所有显示模式下都可用。",
    "Twelve Data 服务器图像模式显示图像、代码、蜡烛周期和最新蜡烛日期。此模式不提供原始蜡烛数据表、图表内缩放或平移，也不支持手动绘图。分析和标注通过聊天进行，受可用数据和权限限制。 从筛选器打开图表会添加自动标注和图例，并提供可横向滚动的宽幅图像。",
    "Tab 和 Shift+Tab 在控件之间移动焦点；Enter 或空格键激活按钮。在标签页中，左右箭头切换标签页，Home 和 End 跳转到首尾标签页。焦点位于支持的对话框或菜单中时，Escape 可将其关闭。",
    "在已加载数据的本地 Canvas 图表中，箭头移动可见范围，+ 和 − 调整缩放，Home 返回最新蜡烛。这些快捷键不适用于 Twelve Data 服务器图像。",
    "图表可能使用本地 Canvas 或服务器图像，具体取决于连接。文字说明或图像替代文本无法完整呈现每根蜡烛、线条或形态。文字大小和对比度设置会改变界面，但不一定改变图表或图像内容。宽表格可能需要横向滚动。"
  ],
  "ja": [
    "ローカルの Canvas チャートが有効で、利用が許可されたローソク足データが読み込まれている場合、テキスト説明、表示範囲内の最大200本のローソク足の表、日付と価格を指定する描画ツールを利用できます。すべての表示モードで利用できるわけではありません。",
    "Twelve Data のサーバー画像モードでは、画像、銘柄コード、足の時間間隔、最新の足の日付を表示します。このモードには元のローソク足データの表、チャート内のズームや移動、手動描画はありません。分析と注記は、利用可能なデータと権限の範囲でチャットを通じて行います。 スクリーナーから開くチャートには自動注釈と凡例が付き、横スクロール可能な拡大画像を表示できます。",
    "Tab と Shift+Tab で操作項目間を移動し、Enter またはスペースキーでボタンを実行します。タブでは左右の矢印キーで切り替え、Home と End で最初と最後へ移動します。対応するダイアログやメニュー内にフォーカスがある場合、Escape で閉じます。",
    "データが読み込まれたローカル Canvas チャートでは、矢印キーで表示範囲を移動し、+ と − でズームを変更し、Home で最新の足に戻ります。これらのショートカットは Twelve Data のサーバー画像では使えません。",
    "接続に応じて、チャートはローカル Canvas またはサーバー画像を使用します。テキスト説明や画像の代替テキストは、すべての足、線、パターンを完全には表せません。文字サイズとコントラストの設定はインターフェースを変更しますが、チャートや画像の内容まで変更するとは限りません。幅の広い表では横スクロールが必要な場合があります。"
  ]
};
export const accessibilityStatementTranslations=Object.fromEntries(Object.entries(rows).map(([code,values])=>[code,Object.fromEntries(source.map((key,index)=>[key,values[index]]))]));
