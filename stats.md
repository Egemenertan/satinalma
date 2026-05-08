<!DOCTYPE html>

<html class="dark" lang="tr"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>DEMURE Procurement Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;family=JetBrains+Mono:wght@500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-tertiary-fixed": "#2d1600",
                        "on-surface": "#e5e2e1",
                        "on-surface-variant": "#bacbb9",
                        "surface-container": "#201f1f",
                        "inverse-surface": "#e5e2e1",
                        "on-tertiary-container": "#794810",
                        "tertiary": "#ffdec4",
                        "secondary-fixed-dim": "#b0c6ff",
                        "on-primary-container": "#00612e",
                        "surface-container-low": "#1c1b1b",
                        "on-primary-fixed-variant": "#005226",
                        "tertiary-fixed": "#ffdcbf",
                        "inverse-on-surface": "#313030",
                        "surface-container-lowest": "#0e0e0e",
                        "on-secondary-fixed-variant": "#00429b",
                        "surface-bright": "#393939",
                        "background": "#131313",
                        "error-container": "#93000a",
                        "on-background": "#e5e2e1",
                        "on-primary": "#003918",
                        "on-tertiary": "#4b2800",
                        "tertiary-container": "#ffba79",
                        "on-secondary-fixed": "#001945",
                        "inverse-primary": "#006d35",
                        "primary": "#75ff9e",
                        "on-error-container": "#ffdad6",
                        "tertiary-fixed-dim": "#fdb878",
                        "surface-variant": "#353534",
                        "surface-container-high": "#2a2a2a",
                        "error": "#ffb4ab",
                        "surface": "#131313",
                        "on-tertiary-fixed-variant": "#6a3c03",
                        "surface-dim": "#131313",
                        "primary-fixed": "#62ff96",
                        "on-secondary-container": "#f2f3ff",
                        "outline": "#859585",
                        "secondary-container": "#0068ed",
                        "on-secondary": "#002d6e",
                        "surface-container-highest": "#353534",
                        "primary-fixed-dim": "#00e475",
                        "on-primary-fixed": "#00210b",
                        "secondary-fixed": "#d9e2ff",
                        "surface-tint": "#00e475",
                        "outline-variant": "#3b4a3d",
                        "on-error": "#690005",
                        "secondary": "#b0c6ff",
                        "primary-container": "#00e676"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "12px",
                        "full": "9999px"
                    },
                    "spacing": {
                        "stack-lg": "32px",
                        "stack-sm": "8px",
                        "base-unit": "8px",
                        "margin": "32px",
                        "stack-md": "16px",
                        "gutter": "24px",
                        "container-max": "1280px"
                    },
                    "fontFamily": {
                        "headline-md": ["Inter"],
                        "label-caps": ["Inter"],
                        "body-base": ["Inter"],
                        "display-lg": ["Inter"],
                        "data-mono": ["JetBrains Mono"]
                    },
                    "fontSize": {
                        "headline-md": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                        "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                        "body-base": ["16px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "400"}],
                        "display-lg": ["40px", {"lineHeight": "48px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                        "data-mono": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "500"}]
                    }
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #131313;
            color: #e5e2e1;
        }
        .bento-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 16px;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #3b4a3d;
            border-radius: 10px;
        }
        .glow-line {
            filter: drop-shadow(0 0 8px rgba(117, 255, 158, 0.4));
        }
        .chart-bar-hover:hover {
            opacity: 1;
            filter: brightness(1.2);
        }
    </style>
</head>
<body class="font-body-base overflow-hidden">
<div class="flex h-screen overflow-hidden">
<!-- SideNavBar -->
<aside class="fixed left-0 top-0 h-full z-40 bg-surface-container border-r border-outline-variant w-64 flex flex-col">
<div class="p-stack-md flex items-center justify-between mb-stack-md">
<span class="font-display-lg text-[24px] font-black tracking-tighter text-on-surface">DEMURE</span>
</div>
<div class="px-stack-sm mb-stack-md">
<button class="w-full bg-primary text-background font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_4px_20px_rgba(117,255,158,0.2)]">
<span class="material-symbols-outlined font-bold">add</span>
<span class="font-bold tracking-tight">Talep Oluştur</span>
</button>
</div>
<nav class="flex-1 overflow-y-auto">
<div class="space-y-1">
<a class="flex items-center text-secondary dark:text-secondary font-bold border-l-4 border-secondary pl-4 py-3 bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">dashboard</span>
<span class="font-body-base">Panel</span>
</a>
<a class="flex items-center text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high pl-5 py-3 transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">request_quote</span>
<span class="font-body-base">Talepler</span>
</a>
<a class="flex items-center text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high pl-5 py-3 transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">local_offer</span>
<span class="font-body-base">Teklifler</span>
</a>
<a class="flex items-center text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high pl-5 py-3 transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">inventory_2</span>
<span class="font-body-base">Ürünler</span>
</a>
<a class="flex items-center text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high pl-5 py-3 transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">warehouse</span>
<span class="font-body-base">Stok</span>
</a>
<a class="flex items-center text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high pl-5 py-3 transition-colors duration-200" href="#">
<span class="material-symbols-outlined mr-3">settings</span>
<span class="font-body-base">Ayarlar</span>
</a>
</div>
</nav>
<div class="mt-auto border-t border-outline-variant p-stack-md bg-surface-container-low">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline">
<img alt="Catherine Kim profile" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC37o4CY421QcTHVeVrq-a7Eu8S6P-pYIHXX0al6n09XmmRTAIZuoOw5sMMpzgvAGcbk2mRiVAAXLnu6QYeVrtMU2YOS-ooBABzM8AQ5V7dbdKIcWrWV2gvK556o75QxUA_K9KGcR6AdfDagIp1GGtAoeOGTzumFhJjIYwsMCdcO9kzPkkAXnPLMHiDp85428E7kf51F-peQ5QT-_yh3HOGQ5il_uSCAK2PSChf3Hvb2FrDj4O--1PnI32dQ5vfRG-ZxJSoDX90zllC"/>
</div>
<div class="flex-1 overflow-hidden">
<p class="font-label-caps text-on-surface truncate">Catherine Kim</p>
<p class="text-[10px] text-on-surface-variant truncate">catkim@untitledui.com</p>
</div>
</div>
<div class="mt-4 space-y-2">
<a class="flex items-center text-on-surface-variant text-[12px] hover:text-on-surface" href="#">
<span class="material-symbols-outlined text-[18px] mr-2">help</span>
                    Destek
                </a>
<a class="flex items-center text-on-surface-variant text-[12px] hover:text-on-surface" href="#">
<span class="material-symbols-outlined text-[18px] mr-2">forum</span>
                    Sohbet
                </a>
</div>
</div>
</aside>
<!-- Main Content -->
<main class="ml-64 flex-1 flex flex-col h-screen overflow-hidden bg-background">
<!-- TopAppBar -->
<header class="flex justify-between items-center px-margin w-full h-16 border-b border-outline-variant sticky top-0 z-50 bg-background/80 backdrop-blur-md">
<div class="flex items-center gap-stack-lg">
<h1 class="font-headline-md text-headline-md text-on-surface uppercase tracking-tight">Panel</h1>
<nav class="hidden md:flex items-center gap-6">
<a class="font-label-caps text-on-surface border-b-2 border-primary pb-1" href="#">Tedarik Ticareti</a>
<a class="font-label-caps text-on-surface-variant hover:text-on-surface transition-all" href="#">Sergi</a>
<a class="font-label-caps text-on-surface-variant hover:text-on-surface transition-all" href="#">Ödemeler</a>
</nav>
</div>
<div class="flex items-center gap-4">
<div class="relative group">
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-on-surface transition-all">search</span>
</div>
<div class="relative cursor-pointer">
<span class="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-all">notifications</span>
<span class="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
</div>
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-on-surface transition-all">account_circle</span>
</div>
</header>
<!-- Scrollable Canvas -->
<div class="flex-1 overflow-y-auto p-margin custom-scrollbar">
<div class="max-w-container-max mx-auto space-y-stack-lg pb-stack-lg">
<!-- KPI Cards Bento -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
<!-- KPI Card 1 -->
<div class="bg-surface-container border border-outline-variant p-6 rounded-xl transition-all duration-300">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-on-surface-variant text-[11px] tracking-widest uppercase">Toplam Talepler</span>
<div class="bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center text-[11px] font-bold">
<span class="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                                +1.9%
                            </div>
</div>
<div class="flex flex-col">
<span class="font-display-lg text-[40px] text-on-surface font-bold tracking-tight">124</span>
<div class="mt-6 h-12 w-full flex items-end gap-[3px]">
<div class="flex-1 bg-surface-variant/40 h-[30%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[45%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[35%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[60%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[50%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[80%] rounded-t-sm"></div>
<div class="flex-1 bg-primary h-[100%] rounded-t-sm shadow-[0_0_12px_rgba(117,255,158,0.4)]"></div>
</div>
</div>
</div>
<!-- KPI Card 2 -->
<div class="bg-surface-container border border-outline-variant p-6 rounded-xl transition-all duration-300">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-on-surface-variant text-[11px] tracking-widest uppercase">Bekleyen Teklifler</span>
<div class="bg-error/10 text-error px-2 py-0.5 rounded-full flex items-center text-[11px] font-bold">
<span class="material-symbols-outlined text-[14px] mr-0.5">trending_down</span>
                                -8.1%
                            </div>
</div>
<div class="flex flex-col">
<span class="font-display-lg text-[40px] text-on-surface font-bold tracking-tight">18</span>
<div class="mt-6 h-12 w-full flex items-end gap-[3px]">
<div class="flex-1 bg-surface-variant/40 h-[90%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[70%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[80%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[50%] rounded-t-sm"></div>
<div class="flex-1 bg-surface-variant/40 h-[40%] rounded-t-sm"></div>
<div class="flex-1 bg-error/80 h-[20%] rounded-t-sm"></div>
</div>
</div>
</div>
<!-- KPI Card 3 -->
<div class="bg-surface-container border border-outline-variant p-6 rounded-xl transition-all duration-300">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-on-surface-variant text-[11px] tracking-widest uppercase">Stok Uyarıları</span>
<span class="text-primary font-bold text-[11px] tracking-widest uppercase">KRİTİK</span>
</div>
<div class="flex flex-col">
<span class="font-display-lg text-[40px] text-primary font-bold tracking-tight">5</span>
<div class="mt-6 flex flex-col gap-2">
<div class="h-1.5 w-full bg-surface-variant/30 rounded-full overflow-hidden">
<div class="bg-primary h-full w-[15%] rounded-full shadow-[0_0_8px_rgba(117,255,158,0.5)]"></div>
</div>
<span class="text-[10px] text-on-surface-variant font-data-mono uppercase tracking-[0.1em]">KAPASİTE KULLANIMI: %15</span>
</div>
</div>
</div>
<!-- KPI Card 4 -->
<div class="bg-surface-container border border-outline-variant p-6 rounded-xl transition-all duration-300">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-on-surface-variant text-[11px] tracking-widest uppercase">Aylık Harcama</span>
<div class="bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center text-[11px] font-bold">
<span class="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                                +24%
                            </div>
</div>
<div class="flex flex-col">
<span class="font-display-lg text-[40px] text-on-surface font-bold font-data-mono tracking-tight">$45.2k</span>
<div class="mt-6 flex items-center gap-3">
<div class="flex-1 bg-surface-variant/30 h-1.5 rounded-full overflow-hidden">
<div class="bg-primary h-full w-3/4 rounded-full shadow-[0_0_8px_rgba(117,255,158,0.5)]"></div>
</div>
<span class="text-[10px] text-on-surface-variant font-data-mono">75%</span>
</div>
</div>
</div>
</div>
<!-- Chart & Activity Grid -->
<div class="bento-grid">
<!-- Main Activity Chart Card -->
<div class="col-span-12 lg:col-span-8 bg-surface-container border border-outline-variant rounded-xl p-8">
<div class="flex items-center justify-between mb-10">
<div>
<h3 class="font-headline-md text-[22px] text-on-surface mb-1">Tedarik Performansı</h3>
<p class="text-on-surface-variant font-body-base text-sm opacity-80">Gerçek zamanlı harcama ve işlem hacmi analizi</p>
</div>
<div class="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl p-1 shadow-inner">
<button class="px-5 py-2 rounded-lg bg-surface-variant/50 text-on-surface font-label-caps text-[11px] tracking-widest transition-all">AYLIK</button>
<button class="px-5 py-2 rounded-lg text-on-surface-variant font-label-caps text-[11px] tracking-widest hover:text-on-surface transition-all">HAFTALIK</button>
<button class="px-5 py-2 rounded-lg text-on-surface-variant font-label-caps text-[11px] tracking-widest hover:text-on-surface transition-all">YILLIK</button>
</div>
</div>
<div class="h-[320px] w-full flex items-end justify-between gap-2.5 pt-12 relative">
<!-- Vertical Grid Lines -->
<div class="absolute inset-x-0 top-12 bottom-0 flex justify-between pointer-events-none opacity-5">
<div class="w-px h-full bg-outline"></div><div class="w-px h-full bg-outline"></div><div class="w-px h-full bg-outline"></div>
<div class="w-px h-full bg-outline"></div><div class="w-px h-full bg-outline"></div><div class="w-px h-full bg-outline"></div>
</div>
<!-- Chart Bars -->
<div class="flex-1 bg-surface-variant/30 h-[40%] rounded-t-lg transition-all chart-bar-hover group cursor-pointer"></div>
<div class="flex-1 bg-surface-variant/30 h-[55%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[45%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[50%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[65%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[38%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[42%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-primary/90 h-[85%] rounded-t-lg relative shadow-[0_0_25px_rgba(117,255,158,0.25)] transition-all">
<div class="absolute -top-16 left-1/2 -translate-x-1/2 bg-on-surface text-background px-4 py-3 rounded-xl text-[12px] font-bold whitespace-nowrap shadow-2xl z-20">
<div class="opacity-70 text-[10px] mb-0.5">Eylül 17</div>
<div class="text-[14px]">$5,869k</div>
<div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-on-surface rotate-45"></div>
</div>
<div class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.1)_5px,rgba(0,0,0,0.1)_10px)] rounded-t-lg"></div>
</div>
<div class="flex-1 bg-surface-variant/30 h-[65%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[35%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[50%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[42%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[58%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[72%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[48%] rounded-t-lg transition-all chart-bar-hover"></div>
<div class="flex-1 bg-surface-variant/30 h-[30%] rounded-t-lg transition-all chart-bar-hover"></div>
</div>
<div class="flex justify-between px-2 mt-6 text-[11px] text-on-surface-variant font-data-mono border-t border-outline-variant/30 pt-4 opacity-60 uppercase tracking-widest">
<span>1</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
</div>
</div>
<!-- Side Quick Access / Priority Stats -->
<div class="col-span-12 lg:col-span-4 space-y-gutter">
<div class="bg-surface-container border border-outline-variant rounded-xl p-8 h-full">
<h4 class="font-label-caps text-on-surface-variant text-[11px] tracking-widest uppercase mb-8">Lojistik Özeti</h4>
<div class="space-y-10">
<div>
<div class="flex justify-between items-baseline mb-2">
<span class="text-sm font-medium opacity-80">Gelen Sevkiyat</span>
<span class="text-primary font-data-mono text-[13px] font-bold">+2.1%</span>
</div>
<div class="text-[22px] font-bold tracking-tight">690.000 ₺</div>
<div class="h-24 mt-6 w-full relative">
<svg class="w-full h-full" preserveaspectratio="none" viewbox="0 0 100 40">
<defs>
<lineargradient id="glow1" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#75ff9e" stop-opacity="0.3"></stop>
<stop offset="100%" stop-color="#75ff9e" stop-opacity="0"></stop>
</lineargradient>
</defs>
<path class="glow-line" d="M0 35 Q 25 35, 45 15 T 90 20 L 100 25" fill="none" stroke="#75ff9e" stroke-linecap="round" stroke-width="2.5"></path>
<path d="M0 35 Q 25 35, 45 15 T 90 20 L 100 25 V 40 H 0 Z" fill="url(#glow1)"></path>
<circle class="glow-line" cx="50" cy="12" fill="#75ff9e" r="4"></circle>
</svg>
</div>
</div>
<div class="border-t border-outline-variant/30 pt-8">
<div class="flex justify-between items-baseline mb-2">
<span class="text-sm font-medium opacity-80">Hizmet Performansı</span>
<span class="text-primary font-data-mono text-[13px] font-bold">+0.4%</span>
</div>
<div class="text-[22px] font-bold tracking-tight">913.000 ₺</div>
<div class="h-24 mt-6 w-full relative">
<svg class="w-full h-full" preserveaspectratio="none" viewbox="0 0 100 40">
<defs>
<lineargradient id="glow2" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#75ff9e" stop-opacity="0.2"></stop>
<stop offset="100%" stop-color="#75ff9e" stop-opacity="0"></stop>
</lineargradient>
</defs>
<path class="glow-line" d="M0 32 Q 30 35, 50 34 T 90 10 L 100 15" fill="none" stroke="#75ff9e" stroke-linecap="round" stroke-width="2.5"></path>
<path d="M0 32 Q 30 35, 50 34 T 90 10 L 100 15 V 40 H 0 Z" fill="url(#glow2)"></path>
<circle class="glow-line" cx="85" cy="12" fill="#75ff9e" r="4"></circle>
</svg>
</div>
</div>
</div>
</div>
</div>
</div>
<!-- Recent Activity Table -->
<div class="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-xl">
<div class="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
<h3 class="font-headline-md text-[18px] text-on-surface">Öncelikli Talepler</h3>
<button class="text-primary font-label-caps text-[11px] tracking-widest hover:underline transition-all">TÜMÜNÜ GÖR</button>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left">
<thead class="bg-surface-container-high/30">
<tr>
<th class="px-8 py-4 font-label-caps text-on-surface-variant text-[10px] tracking-widest uppercase">TALEP ID</th>
<th class="px-8 py-4 font-label-caps text-on-surface-variant text-[10px] tracking-widest uppercase">KONU</th>
<th class="px-8 py-4 font-label-caps text-on-surface-variant text-[10px] tracking-widest uppercase">DURUM</th>
<th class="px-8 py-4 font-label-caps text-on-surface-variant text-[10px] tracking-widest uppercase">ÖNCELİK</th>
<th class="px-8 py-4 font-label-caps text-on-surface-variant text-[10px] tracking-widest uppercase">TARİH</th>
</tr>
</thead>
<tbody class="divide-y divide-outline-variant/30">
<tr class="hover:bg-surface-variant/10 transition-colors group">
<td class="px-8 py-5 font-data-mono text-sm opacity-60">#PR-8921</td>
<td class="px-8 py-5 text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Ham Madde Tedariği - Silikon</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-tighter">Beklemede</span>
</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-error/10 text-error border border-error/20 uppercase tracking-tighter">Yüksek</span>
</td>
<td class="px-8 py-5 text-sm text-on-surface-variant font-data-mono">17.09.2024</td>
</tr>
<tr class="hover:bg-surface-variant/10 transition-colors group">
<td class="px-8 py-5 font-data-mono text-sm opacity-60">#PR-8922</td>
<td class="px-8 py-5 text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Lojistik Konteyner Talebi - Asya</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20 uppercase tracking-tighter">İnceleniyor</span>
</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-tertiary/10 text-on-tertiary-container border border-tertiary/20 uppercase tracking-tighter">Orta</span>
</td>
<td class="px-8 py-5 text-sm text-on-surface-variant font-data-mono">16.09.2024</td>
</tr>
<tr class="hover:bg-surface-variant/10 transition-colors group">
<td class="px-8 py-5 font-data-mono text-sm opacity-60">#PR-8923</td>
<td class="px-8 py-5 text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Yazılım Lisans Yenileme</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-tighter">Onaylandı</span>
</td>
<td class="px-8 py-5">
<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-on-surface-variant/10 text-on-surface-variant border border-on-surface-variant/20 uppercase tracking-tighter">Düşük</span>
</td>
<td class="px-8 py-5 text-sm text-on-surface-variant font-data-mono">15.09.2024</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>
</div>
<!-- Footer -->
<footer class="flex justify-between items-center px-margin w-full py-4 border-t border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md">
<div class="flex items-center gap-6">
<span class="font-label-caps text-[10px] text-on-surface-variant tracking-widest">© 2024 DEMURE PROCUREMENT. TÜM HAKLARI SAKLIDIR.</span>
<nav class="flex gap-4">
<a class="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface underline transition-all" href="#">Gizlilik Politikası</a>
<a class="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface underline transition-all" href="#">Kullanım Koşulları</a>
<a class="font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface underline transition-all" href="#">Güvenlik</a>
</nav>
</div>
<div class="flex items-center gap-2.5">
<span class="text-[10px] font-data-mono text-on-surface-variant opacity-70">V 2.4.1</span>
<div class="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(117,255,158,0.8)]"></div>
</div>
</footer>
</main>
</div>
<!-- Background Image Asset with Data Alt -->
<div class="hidden">
<img data-alt="A professional data visualization abstract background with subtle grid lines and glowing data points. The scene uses a deep charcoal and black color palette with sharp accents of emerald green and electric blue light. It represents a high-tech supply chain logistics environment with a minimalist corporate aesthetic, low-key lighting, and sharp focus on geometric patterns. The overall mood is sophisticated, systematic, and commanding." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrlpuMHNCzx0VINGFz2QUGetD88C9k9xTUIBG5NnF9B-rq9jecNLit8IqLUN_hrY_we1BL0QzlDSYiEMSXwckcqhbMdKc8w5jbmmAtUCiUaCObe-rEmUbxXWlI2vCSq48erupGFYjWtngzb5LYAwiEkgwtEqyioWi5UqvEaJwPHeHcUqrgS08RSe35VikLlwN1WAK0ZdXNUxjlGii9QbRSy1uImqqG5Gp80uM4lSgLZOJQdn5dPAW7bHJUBoWZce9XzLthZoxrzS_5"/>
</div>
</body></html>