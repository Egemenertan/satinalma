<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Overview Panel - SaaS Dashboard</title>
<!-- Tailwind CSS v3 with forms and container-queries -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Google Font: Plus Jakarta Sans -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind Configuration -->
<script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
          },
          colors: {
            brand: {
              green: '#20e277',
              neon: '#25eb7e',
              lightGreen: '#45f18c',
              dark: '#111315',
              grayBg: '#f2f4f7',
              border: '#eaedf1',
              subtext: '#8a94a6',
              cardBg: '#ffffff'
            }
          },
          boxShadow: {
            'card': '0 10px 30px -10px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
            'floating': '0 20px 40px -15px rgba(34, 197, 94, 0.25)',
          }
        }
      }
    }
  </script>
<!-- BEGIN: Custom Styles -->
<style data-purpose="custom-layout">
    body {
      background-color: #f1f3f6;
      color: #111315;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Frosted glass effect for floating hero card */
    .glass-card-main {
      background: linear-gradient(135deg, rgba(82, 245, 148, 0.82) 0%, rgba(52, 230, 126, 0.7) 100%);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      box-shadow: 0 25px 50px -12px rgba(46, 213, 115, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.5);
    }
    .glass-card-sub1 {
      background: linear-gradient(135deg, rgba(144, 248, 185, 0.6) 0%, rgba(98, 237, 153, 0.45) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 20px 35px -10px rgba(46, 213, 115, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.4);
    }
    .glass-card-sub2 {
      background: linear-gradient(135deg, rgba(175, 250, 203, 0.4) 0%, rgba(135, 241, 175, 0.3) 100%);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    /* Waveform visual elements */
    .chart-bar {
      transition: height 0.2s ease;
    }
  </style>
<!-- END: Custom Styles -->
</head>
<body class="min-h-screen p-4 md:p-6 lg:p-8 flex justify-center selection:bg-brand-green selection:text-black">
<div class="w-full max-w-[1720px] flex flex-col gap-6" data-purpose="dashboard-root">
<!-- BEGIN: TopNavigationBar -->
<header class="flex flex-wrap items-center justify-between gap-4 py-1" data-purpose="top-navigation">
<!-- Left side: Brand and Primary Nav -->
<div class="flex items-center gap-7">
<!-- Logo Mark -->
<div class="flex items-center gap-1.5 cursor-pointer">
<div class="w-11 h-11 rounded-2xl bg-[#52f594] flex items-center justify-center shadow-sm">
<svg class="w-6 h-6 text-black fill-current" viewbox="0 0 24 24">
<path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"></path>
</svg>
</div>
<span class="text-xs text-gray-500 font-semibold self-start ml-0.5">®</span>
</div>
<!-- Navigation Tabs -->
<nav class="hidden md:flex items-center gap-1.5 text-[15px] font-medium text-gray-700">
<a class="px-5 py-2.5 rounded-full bg-black text-white font-medium transition-colors" href="#">Overview</a>
<a class="px-5 py-2.5 rounded-full hover:text-black hover:bg-white/70 transition-all text-gray-600" href="#">Analytics</a>
<a class="px-5 py-2.5 rounded-full hover:text-black hover:bg-white/70 transition-all text-gray-600" href="#">Companies</a>
<a class="px-5 py-2.5 rounded-full hover:text-black hover:bg-white/70 transition-all text-gray-600" href="#">Documents</a>
<a class="px-5 py-2.5 rounded-full hover:text-black hover:bg-white/70 transition-all text-gray-600" href="#">Calculator</a>
</nav>
</div>
<!-- Right side: Search, Icons, Profile -->
<div class="flex items-center gap-3">
<!-- Search Pill -->
<div class="relative flex items-center">
<div class="absolute left-4 pointer-events-none text-gray-700">
<svg class="w-4 h-4 fill-current" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" fill-rule="evenodd"></path>
</svg>
</div>
<input class="w-64 lg:w-72 pl-11 pr-5 py-2.5 text-sm bg-white/80 border-0 rounded-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all shadow-sm" placeholder="Type Client Name or ID" type="text"/>
</div>
<!-- Notification Icon with green dot -->
<button class="relative w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
<svg class="w-5 h-5 fill-current" viewbox="0 0 24 24">
<path d="M12 2C10.34 2 9 3.34 9 5V5.29C6.71 6.3 5 8.79 5 11.5V16L3 18V19H21V18L19 16V11.5C19 8.79 17.29 6.3 15 5.29V5C15 3.34 13.66 2 12 2ZM12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22Z"></path>
</svg>
<span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-green ring-2 ring-white"></span>
</button>
<!-- Settings Gear Icon -->
<button class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewbox="0 0 24 24">
<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
</button>
<!-- User Profile -->
<div class="flex items-center gap-3 pl-1">
<div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
<img alt="Jordan Lee Avatar" class="w-full h-full object-cover object-top" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDr_RT0mk8cdqRR1Sll7E-Pj-xBGRc3vfhwiiExRB3_kYwAq60N7Q_Oh9c9dgauCS4PY3We-JwoAOrMpajOZqGdqCL1cnq2bES5fcRdYaX2od01TM0_h-mAg2CGT2HM4qJ0jIVKfUNWy8OeEEhBuhB26GHdBsFfqvzxTNglGguCy5n_49epcdYwSAd3np-2lB8V5AuCJR7sGzbqIUHKju5OJpkMErje8TbddJDzYM97L03jfD5oV49Xi5jgRXq0UoR8dA"/>
</div>
<div class="hidden sm:flex flex-col">
<span class="text-sm font-semibold leading-tight text-gray-900">Jordan Lee</span>
<span class="text-xs text-gray-400 font-normal">Manager</span>
</div>
</div>
</div>
</header>
<!-- END: TopNavigationBar -->
<!-- BEGIN: HeroSubheader -->
<section class="relative pt-3 pb-2 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6" data-purpose="dashboard-hero">
<!-- Title & Context -->
<div class="flex flex-col gap-1.5 z-10">
<span class="text-xs font-medium tracking-wide text-gray-500">Data Based on All Clients</span>
<div class="flex items-center gap-4">
<h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-black">Overview Panel</h1>
<!-- Slider/carousel line indicator -->
<div class="flex items-center gap-1.5 mt-2 bg-gray-300/60 p-1 rounded-full px-2">
<div class="w-6 h-1.5 bg-gray-500 rounded-full"></div>
<div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
</div>
</div>
</div>
<!-- Floating Translucent Glass Cards (Absolute Center Stack in Desktop) -->
<div class="lg:absolute left-1/2 -translate-x-1/2 -top-2 w-[420px] max-w-full h-48 pointer-events-none z-10 flex items-center justify-center">
<!-- Background 3rd stacked card -->
<div class="absolute w-[360px] h-36 rounded-3xl glass-card-sub2 transform translate-x-16 -translate-y-3 rotate-6 opacity-60">
<div class="p-4 flex justify-end">
<svg class="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
</div>
</div>
<!-- Background 2nd stacked card -->
<div class="absolute w-[380px] h-40 rounded-3xl glass-card-sub1 transform translate-x-8 -translate-y-1 rotate-3 opacity-80">
<div class="p-5 flex justify-end">
<svg class="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
</div>
<div class="px-6 text-sm text-black/70 font-medium">nation<br/>savings</div>
</div>
<!-- Front Main Frosted Green Card -->
<div class="relative w-[400px] h-44 rounded-3xl glass-card-main p-6 flex flex-col justify-between pointer-events-auto shadow-floating">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2">
<svg class="w-4 h-4 text-black fill-current" viewbox="0 0 24 24">
<path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"></path>
</svg>
<span class="text-sm font-semibold text-black tracking-tight">Account Insights</span>
</div>
<button class="text-black/80 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewbox="0 0 24 24">
<path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
</button>
</div>
<div class="pr-6">
<p class="text-[19px] leading-snug font-semibold text-black">
              Last month, automation boosted your time savings to <span class="font-extrabold">48.3 hours</span>
</p>
</div>
</div>
</div>
<!-- Hero Right Filters -->
<div class="flex flex-wrap items-center gap-2.5 z-10 self-end lg:self-center">
<!-- Date Range Pills -->
<div class="flex items-center bg-white/80 rounded-full px-4 py-2.5 shadow-sm text-sm font-medium text-gray-700 gap-2.5">
<svg class="w-4 h-4 text-black" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24">
<rect height="18" rx="2" ry="2" width="18" x="3" y="4"></rect>
<line x1="16" x2="16" y1="2" y2="6"></line>
<line x1="8" x2="8" y1="2" y2="6"></line>
<line x1="3" x2="21" y1="10" y2="10"></line>
</svg>
<span>01.12.2023</span>
</div>
<div class="bg-white/80 rounded-full px-4 py-2.5 shadow-sm text-sm font-medium text-gray-700">
<span>01.12.2024</span>
</div>
<!-- All Partner Dropdown Pill -->
<button class="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2.5 shadow-sm text-sm font-medium text-gray-700 hover:bg-white transition-colors">
<span>All Partner</span>
<svg class="w-3.5 h-3.5 text-gray-600" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" fill-rule="evenodd"></path>
</svg>
</button>
</div>
</section>
<!-- END: HeroSubheader -->
<!-- BEGIN: MainContentGrid -->
<main class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start" data-purpose="dashboard-grid">
<!-- LEFT 8 COLS: Analytical Cards & Graphs -->
<div class="xl:col-span-8 flex flex-col gap-6" data-purpose="primary-metrics-container">
<!-- Row 1: Top 3 Metric Cards -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
<!-- Card 1: Processed Items -->
<div class="bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between h-56" data-purpose="processed-items-card">
<!-- Header -->
<div class="flex items-center gap-2 text-gray-800 font-semibold text-sm">
<svg class="w-4 h-4 fill-current text-black" viewbox="0 0 20 20">
<path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
</svg>
<span>Processed Items</span>
</div>
<!-- Big Stat -->
<div class="flex items-start">
<span class="text-4xl font-extrabold tracking-tight text-gray-900">97,22</span>
<span class="text-sm font-semibold text-gray-500 mt-1 ml-0.5">%</span>
</div>
<!-- Bottom Stats & Progress -->
<div class="space-y-2.5">
<div class="flex justify-between text-xs text-gray-400 font-medium">
<div>
<span class="text-black font-semibold block text-sm">14.9k</span>
                  Auto-Processed
                </div>
<div class="text-right">
<span class="text-black font-semibold block text-sm">18k</span>
                  Pending Check
                </div>
</div>
<!-- Segmented Progress Bar -->
<div class="h-5 w-full bg-gray-100 rounded-md flex overflow-hidden p-0.5 gap-0.5 items-center">
<div class="h-full bg-brand-neon rounded-sm w-[8%]"></div>
<div class="h-full bg-black rounded-sm w-[5%]"></div>
<div class="h-full bg-gray-200 rounded-sm w-[55%]"></div>
<!-- Fine barcode/ticks -->
<div class="h-full flex items-center gap-[2px] w-[32%] pl-1 border-l border-brand-green/60">
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
<div class="w-[1.5px] h-3 bg-gray-300"></div>
</div>
</div>
</div>
</div>
<!-- Card 2: Synced Records (Gauge) -->
<div class="bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between h-56 relative overflow-hidden" data-purpose="synced-records-card">
<!-- Header -->
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-gray-800 font-semibold text-sm">
<svg class="w-4 h-4 fill-current text-black" viewbox="0 0 24 24">
<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"></path>
</svg>
<span>Synced Records</span>
</div>
</div>
<!-- Substats row -->
<div class="flex justify-between text-xs">
<div>
<span class="text-base font-bold text-gray-900 block">174</span>
<span class="text-gray-400">Verified</span>
</div>
<div class="text-right">
<span class="text-base font-bold text-gray-900 block">31</span>
<span class="text-gray-400">Pending Check</span>
</div>
</div>
<!-- Gauge Meter SVG Visual -->
<div class="relative w-full flex flex-col items-center justify-end -mb-1">
<svg class="w-56 h-28" viewbox="0 0 200 100">
<!-- Outer Arc Background -->
<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" stroke-linecap="round" stroke-width="8"></path>
<!-- Gauge active fill segments -->
<path d="M 20 100 A 80 80 0 0 1 148 38" fill="none" stroke="#d1d5db" stroke-linecap="round" stroke-width="8"></path>
<path d="M 125 48 A 80 80 0 0 1 155 46" fill="none" stroke="#000000" stroke-linecap="round" stroke-width="8"></path>
<!-- Glowing Green Dot -->
<circle cx="155" cy="46" fill="#20e277" r="6"></circle>
</svg>
<!-- Center Percent Text -->
<div class="absolute bottom-1 flex items-baseline">
<span class="text-3xl font-bold tracking-tight text-gray-900">71,74</span>
<span class="text-xs font-semibold text-gray-500 ml-0.5">%</span>
</div>
</div>
</div>
<!-- Card 3: Anomalies -->
<div class="bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between h-56" data-purpose="anomalies-card">
<!-- Header -->
<div class="flex items-center gap-2 text-gray-800 font-semibold text-sm">
<svg class="w-4 h-4 fill-current text-black" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" fill-rule="evenodd"></path>
</svg>
<span>Anomalies</span>
</div>
<!-- Big Stat -->
<div class="flex items-start justify-end pr-8">
<span class="text-4xl font-extrabold tracking-tight text-gray-900">10,12</span>
<span class="text-sm font-semibold text-gray-500 mt-1 ml-0.5">%</span>
</div>
<!-- Bottom Substats & Progress -->
<div class="space-y-2.5">
<div class="flex justify-between text-xs text-gray-400 font-medium">
<div>
<span class="text-black font-semibold block text-sm">1.62k</span>
                  Detected
                </div>
<div class="text-right">
<span class="text-black font-semibold block text-sm">13.7k</span>
                  Total Items
                </div>
</div>
<!-- Bar with ticks -->
<div class="h-5 w-full bg-gray-100 rounded-md flex overflow-hidden p-0.5 gap-0.5 items-center">
<div class="h-full bg-brand-neon rounded-sm w-[7%]"></div>
<div class="h-full bg-black rounded-sm w-[8%]"></div>
<div class="h-full bg-gray-200 rounded-sm w-[6%] border-r border-brand-green"></div>
<!-- Tick marks -->
<div class="h-full flex items-center gap-[3px] w-[79%] pl-1">
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
<div class="w-[1px] h-3 bg-gray-300"></div><div class="w-[1px] h-3 bg-gray-300"></div>
</div>
</div>
</div>
</div>
</div>
<!-- Row 2: Two Large Waveform Analytics Cards -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<!-- Card 4: Utilization -->
<div class="bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between" data-purpose="utilization-graph-card">
<!-- Header -->
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-gray-800 font-semibold text-sm">
<svg class="w-4 h-4 fill-current text-black" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" fill-rule="evenodd"></path>
</svg>
<span>Utilization</span>
</div>
<button class="text-gray-400 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
</div>
<!-- Stats Triple Column -->
<div class="flex items-center justify-between pt-4 pb-2">
<div class="space-y-3 text-xs">
<div>
<span class="text-sm font-bold text-gray-900 block">65%</span>
<span class="text-gray-400">Syncs</span>
</div>
<div>
<span class="text-sm font-bold text-gray-900 block">82%</span>
<span class="text-gray-400">Fetches</span>
</div>
</div>
<div class="text-center">
<span class="text-xs text-gray-400 block mb-1">Average Account Stats</span>
<div class="flex items-start justify-center">
<span class="text-4xl font-extrabold text-gray-900 tracking-tight">56,1</span>
<span class="text-xs font-semibold text-gray-400 mt-1 ml-0.5">%</span>
</div>
</div>
<div class="space-y-3 text-xs text-right">
<div>
<span class="text-sm font-bold text-gray-900 block">34%</span>
<span class="text-gray-400">Manuals</span>
</div>
<div>
<span class="text-sm font-bold text-gray-900 block">12%</span>
<span class="text-gray-400">Autosync</span>
</div>
</div>
</div>
<!-- Frequency Waveform Bar Chart -->
<div class="pt-4 border-t border-gray-100">
<div class="h-28 flex items-end justify-between gap-[2px] relative">
<!-- Threshold line (green marker) -->
<div class="absolute right-[22%] top-0 bottom-0 w-[1.5px] bg-brand-green z-10 flex flex-col justify-end">
<div class="w-2 h-2 -ml-[3.5px] rounded-full bg-brand-green"></div>
</div>
<!-- Smooth Wave Bars Simulation -->
<!-- Jun side -->
<div class="w-[2px] h-[10%] bg-gray-300"></div><div class="w-[2px] h-[12%] bg-gray-300"></div><div class="w-[2px] h-[16%] bg-gray-300"></div>
<div class="w-[2px] h-[22%] bg-gray-300"></div><div class="w-[2px] h-[28%] bg-gray-300"></div><div class="w-[2px] h-[34%] bg-gray-300"></div>
<div class="w-[2px] h-[40%] bg-gray-300"></div><div class="w-[2px] h-[45%] bg-gray-400"></div><div class="w-[2px] h-[52%] bg-gray-400"></div>
<!-- Rising crest with black bars -->
<div class="w-[2px] h-[65%] bg-black"></div><div class="w-[2px] h-[78%] bg-black"></div><div class="w-[2px] h-[90%] bg-black"></div>
<div class="w-[2px] h-[82%] bg-black"></div><div class="w-[2px] h-[88%] bg-black"></div><div class="w-[2px] h-[95%] bg-black"></div>
<div class="w-[2px] h-[75%] bg-black"></div><div class="w-[2px] h-[82%] bg-black"></div><div class="w-[2px] h-[68%] bg-black"></div>
<div class="w-[2px] h-[72%] bg-black"></div><div class="w-[2px] h-[78%] bg-black"></div><div class="w-[2px] h-[85%] bg-black"></div>
<!-- Transition to Jul side -->
<div class="w-[2px] h-[70%] bg-black"></div><div class="w-[2px] h-[62%] bg-black"></div><div class="w-[2px] h-[55%] bg-black"></div>
<div class="w-[2px] h-[48%] bg-gray-400"></div><div class="w-[2px] h-[40%] bg-gray-400"></div><div class="w-[2px] h-[35%] bg-gray-300"></div>
<div class="w-[2px] h-[30%] bg-gray-300"></div><div class="w-[2px] h-[22%] bg-gray-200"></div><div class="w-[2px] h-[18%] bg-gray-200"></div>
<div class="w-[2px] h-[15%] bg-gray-200"></div><div class="w-[2px] h-[12%] bg-gray-200"></div><div class="w-[2px] h-[10%] bg-gray-200"></div>
<div class="w-[2px] h-[8%] bg-gray-200"></div><div class="w-[2px] h-[8%] bg-gray-200"></div><div class="w-[2px] h-[8%] bg-gray-200"></div>
</div>
<!-- Timeline labels -->
<div class="flex justify-between text-[11px] text-gray-400 pt-2 font-medium">
<span>Jun</span>
<span>Jul</span>
</div>
</div>
</div>
<!-- Card 5: Timely Closures -->
<div class="bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between" data-purpose="timely-closures-card">
<!-- Header -->
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-gray-800 font-semibold text-sm">
<svg class="w-4 h-4 text-black fill-current" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fill-rule="evenodd"></path>
</svg>
<span>Timely Closures</span>
</div>
<button class="text-gray-400 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
</div>
<!-- Stats Triple Column -->
<div class="flex items-center justify-between pt-4 pb-2">
<div class="space-y-3 text-xs">
<div>
<span class="text-sm font-bold text-gray-900 block">84</span>
<span class="text-gray-400">Done</span>
</div>
<div>
<span class="text-sm font-bold text-gray-900 block">24%</span>
<span class="text-gray-400">Active</span>
</div>
</div>
<div class="text-center">
<span class="text-xs text-gray-400 block mb-1">Average Account Stats</span>
<div class="flex items-start justify-center">
<span class="text-4xl font-extrabold text-gray-900 tracking-tight">82,6</span>
<span class="text-xs font-semibold text-gray-400 mt-1 ml-0.5">%</span>
</div>
</div>
<div class="space-y-3 text-xs text-right">
<div>
<span class="text-sm font-bold text-gray-900 block">84/0%</span>
<span class="text-gray-400">OnTime</span>
</div>
<div>
<span class="text-sm font-bold text-gray-900 block">19/5</span>
<span class="text-gray-400">Timely</span>
</div>
</div>
</div>
<!-- Waveform Bar Chart -->
<div class="pt-4 border-t border-gray-100">
<div class="h-28 flex items-end justify-between gap-[2px] relative">
<!-- Threshold line (green marker) -->
<div class="absolute right-[22%] top-0 bottom-0 w-[1.5px] bg-brand-green z-10 flex flex-col justify-end">
<div class="w-2 h-2 -ml-[3.5px] rounded-full bg-brand-green"></div>
</div>
<!-- Smooth Curve bars -->
<div class="w-[2px] h-[8%] bg-gray-300"></div><div class="w-[2px] h-[12%] bg-gray-300"></div><div class="w-[2px] h-[15%] bg-gray-300"></div>
<div class="w-[2px] h-[22%] bg-gray-300"></div><div class="w-[2px] h-[30%] bg-gray-300"></div><div class="w-[2px] h-[42%] bg-gray-300"></div>
<div class="w-[2px] h-[55%] bg-gray-300"></div><div class="w-[2px] h-[70%] bg-gray-300"></div><div class="w-[2px] h-[82%] bg-gray-300"></div>
<div class="w-[2px] h-[88%] bg-gray-400"></div><div class="w-[2px] h-[80%] bg-gray-400"></div><div class="w-[2px] h-[75%] bg-gray-400"></div>
<!-- Crest with dark elements -->
<div class="w-[2px] h-[68%] bg-black"></div><div class="w-[2px] h-[62%] bg-black"></div><div class="w-[2px] h-[65%] bg-black"></div>
<div class="w-[2px] h-[72%] bg-black"></div><div class="w-[2px] h-[78%] bg-black"></div><div class="w-[2px] h-[70%] bg-black"></div>
<div class="w-[2px] h-[65%] bg-black"></div><div class="w-[2px] h-[62%] bg-black"></div><div class="w-[2px] h-[58%] bg-black"></div>
<div class="w-[2px] h-[52%] bg-black"></div><div class="w-[2px] h-[48%] bg-black"></div><div class="w-[2px] h-[40%] bg-black"></div>
<!-- Low trail to Jul -->
<div class="w-[2px] h-[30%] bg-gray-200"></div><div class="w-[2px] h-[25%] bg-gray-200"></div><div class="w-[2px] h-[20%] bg-gray-200"></div>
<div class="w-[2px] h-[16%] bg-gray-200"></div><div class="w-[2px] h-[12%] bg-gray-200"></div><div class="w-[2px] h-[10%] bg-gray-200"></div>
<div class="w-[2px] h-[8%] bg-gray-200"></div><div class="w-[2px] h-[6%] bg-gray-200"></div><div class="w-[2px] h-[6%] bg-gray-200"></div>
</div>
<div class="flex justify-between text-[11px] text-gray-400 pt-2 font-medium">
<span>Jun</span>
<span>Jul</span>
</div>
</div>
</div>
</div>
<!-- Row 3: Client Quick Contact Cards -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6" data-purpose="client-quick-cards">
<!-- Client 1 -->
<div class="bg-white rounded-3xl p-5 shadow-card flex items-center justify-between hover:shadow-md transition-shadow">
<div class="flex items-center gap-3.5">
<div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
<svg class="w-4 h-4 fill-current text-gray-700" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" fill-rule="evenodd"></path>
</svg>
</div>
<div>
<h4 class="text-sm font-bold text-gray-900 leading-tight">Eva Robinson</h4>
<p class="text-xs text-gray-400">eva.r@syncdesk.co</p>
</div>
</div>
<button class="text-gray-400 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
</div>
<!-- Client 2 -->
<div class="bg-white rounded-3xl p-5 shadow-card flex items-center justify-between hover:shadow-md transition-shadow">
<div class="flex items-center gap-3.5">
<div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
<svg class="w-4 h-4 fill-current text-gray-700" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" fill-rule="evenodd"></path>
</svg>
</div>
<div>
<h4 class="text-sm font-bold text-gray-900 leading-tight">Helena Crims</h4>
<p class="text-xs text-gray-400">helena.c@veriq.tech</p>
</div>
</div>
<button class="text-gray-400 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
</div>
<!-- Client 3 -->
<div class="bg-white rounded-3xl p-5 shadow-card flex items-center justify-between hover:shadow-md transition-shadow">
<div class="flex items-center gap-3.5">
<div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
<svg class="w-4 h-4 fill-current text-gray-700" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" fill-rule="evenodd"></path>
</svg>
</div>
<div>
<h4 class="text-sm font-bold text-gray-900 leading-tight">Anna Morris</h4>
<p class="text-xs text-gray-400">anna@domain.io</p>
</div>
</div>
<button class="text-gray-400 hover:text-black">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
</div>
</div>
</div>
<!-- RIGHT 4 COLS: AI Assistant Chat Card -->
<aside class="xl:col-span-4 bg-white rounded-3xl p-6 shadow-card flex flex-col justify-between min-h-[670px] h-full" data-purpose="ai-assistant-panel">
<!-- Header -->
<div class="flex items-center justify-between pb-4 border-b border-gray-100">
<div class="flex items-center gap-2">
<svg class="w-5 h-5 text-black fill-current" viewbox="0 0 24 24">
<path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"></path>
</svg>
<span class="text-base font-bold text-gray-900">AI Assistant</span>
</div>
<!-- Opposing diagonal arrows expand icon -->
<button class="text-gray-400 hover:text-black p-1 transition-colors">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24">
<path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
</button>
</div>
<!-- Chat Conversation Body -->
<div class="flex-1 py-6 flex flex-col gap-6" data-purpose="chat-messages">
<!-- Message 1: User Request -->
<div class="flex flex-col gap-3">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
<img alt="Jordan Lee" class="w-full h-full object-cover object-top" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDr_RT0mk8cdqRR1Sll7E-Pj-xBGRc3vfhwiiExRB3_kYwAq60N7Q_Oh9c9dgauCS4PY3We-JwoAOrMpajOZqGdqCL1cnq2bES5fcRdYaX2od01TM0_h-mAg2CGT2HM4qJ0jIVKfUNWy8OeEEhBuhB26GHdBsFfqvzxTNglGguCy5n_49epcdYwSAd3np-2lB8V5AuCJR7sGzbqIUHKju5OJpkMErje8TbddJDzYM97L03jfD5oV49Xi5jgRXq0UoR8dA"/>
</div>
<span class="text-sm font-bold text-gray-900">Jordan Lee</span>
</div>
<!-- Bubble -->
<div class="pl-11">
<p class="text-sm text-gray-800 leading-relaxed font-medium">
                Hey Daxa, Can you check for discrepancies in revenue vs. projected values?
              </p>
<!-- Attached Document Capsule -->
<div class="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50/70 text-xs font-medium text-gray-700">
<div class="w-4 h-4 rounded bg-brand-green/20 text-brand-green flex items-center justify-center">
<svg class="w-3 h-3 text-emerald-600 fill-current" viewbox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>
</div>
<div class="w-4 h-4 bg-gray-800 rounded text-white flex items-center justify-center text-[9px]">
                  =
                </div>
<span>ID: #6287439</span>
</div>
<span class="block text-[11px] text-gray-400 mt-2 text-right">10:12</span>
</div>
</div>
<!-- Message 2: Daxa AI Response -->
<div class="flex flex-col gap-3 pt-2">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-2xl bg-[#52f594] flex items-center justify-center shrink-0">
<svg class="w-4 h-4 text-black fill-current" viewbox="0 0 24 24">
<path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"></path>
</svg>
</div>
<span class="text-sm font-bold text-gray-900">Daxa</span>
</div>
<!-- Content -->
<div class="pl-11 space-y-3">
<p class="text-sm font-bold text-gray-900">
                Main Deviations by Month:
              </p>
<!-- Monthly stats list -->
<div class="space-y-2 text-sm">
<div class="flex items-center justify-between text-gray-700">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
<span class="text-gray-500 font-normal">July</span>
</div>
<span class="font-bold text-gray-900">$18.9K</span>
</div>
<div class="flex items-center justify-between text-gray-700">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
<span class="text-gray-500 font-normal">August</span>
</div>
<span class="font-bold text-gray-900">$21.7K</span>
</div>
<div class="flex items-center justify-between text-gray-700">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-black"></span>
<span class="text-gray-900 font-semibold">September</span>
</div>
<span class="font-bold text-gray-900">$11.9K</span>
</div>
</div>
<!-- AI Status Progress Indicator -->
<div class="pt-2">
<div class="h-4 w-full bg-gray-100 rounded-md flex overflow-hidden p-0.5 gap-0.5 items-center">
<div class="h-full bg-brand-neon rounded-sm w-[12%]"></div>
<div class="h-full bg-black rounded-sm w-[18%]"></div>
<div class="h-full bg-gray-200 rounded-sm w-[45%]"></div>
<!-- tick marks -->
<div class="h-full flex items-center gap-[2px] w-[25%] pl-1 border-l border-brand-green/60">
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
<div class="w-[1.5px] h-2.5 bg-gray-300"></div>
</div>
</div>
<span class="block text-[11px] text-gray-400 mt-2 text-right">10:13</span>
</div>
</div>
</div>
</div>
<!-- Bottom Action Bar & Input -->
<div class="pt-4 border-t border-gray-100 flex flex-col gap-3.5" data-purpose="chat-input-controls">
<!-- Quick Action Buttons -->
<div class="flex items-center gap-2">
<!-- Files -->
<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 text-xs font-semibold transition-colors">
<svg class="w-3.5 h-3.5 text-gray-800" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" fill-rule="evenodd"></path>
</svg>
<span>Files</span>
</button>
<!-- Images -->
<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 text-xs font-semibold transition-colors">
<svg class="w-3.5 h-3.5 text-gray-800" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" fill-rule="evenodd"></path>
</svg>
<span>Images</span>
</button>
<!-- Audio Chat -->
<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 text-xs font-semibold transition-colors">
<svg class="w-3.5 h-3.5 text-gray-800" fill="currentColor" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" fill-rule="evenodd"></path>
</svg>
<span>Audio Chat</span>
</button>
</div>
<!-- Input Bar -->
<div class="relative flex items-center bg-gray-100/90 rounded-full p-1.5 pr-2">
<input class="w-full bg-transparent border-0 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0" placeholder="Enter your AI Assistant Request" type="text"/>
<div class="flex items-center gap-1.5 shrink-0">
<!-- Add attachment plus -->
<button class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-colors">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewbox="0 0 24 24">
<path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
</button>
<!-- Send button -->
<button class="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white hover:bg-gray-800 transition-colors shadow-sm">
<svg class="w-4 h-4 fill-current transform rotate-45 -translate-y-0.5 -translate-x-0.5" viewbox="0 0 24 24">
<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
</svg>
</button>
</div>
</div>
</div>
</aside>
<!-- END: AI Assistant Chat Card -->
</main>
<!-- END: MainContentGrid -->
</div>
</body></html>