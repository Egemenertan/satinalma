'use client'

import { useState } from 'react'
import { 
  Search, 
  TrendingUp, 
  Package, 
  Clock, 
  Star, 
  Calendar,
  BarChart3,
  MoreHorizontal,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('1 year')

  // Mock data for charts
  const monthlyData = [
    { month: 'Jan', distance: 180, category: 'more than 150 km' },
    { month: 'Feb', distance: 220, category: 'more than 200 km' },
    { month: 'Mar', distance: 160, category: 'more than 150 km' },
    { month: 'Apr', distance: 190, category: 'more than 150 km' },
    { month: 'May', distance: 240, category: 'more than 200 km' },
    { month: 'Jun', distance: 170, category: 'more than 150 km' },
    { month: 'Jul', distance: 200, category: 'more than 200 km' },
    { month: 'Aug', distance: 150, category: 'more than 100 km' },
    { month: 'Sep', distance: 180, category: 'more than 150 km' },
    { month: 'Oct', distance: 210, category: 'more than 200 km' },
    { month: 'Nov', distance: 160, category: 'more than 150 km' },
    { month: 'Dec', distance: 190, category: 'more than 150 km' }
  ]

  const calendarData = Array.from({ length: 28 }, (_, i) => ({
    day: i + 1,
    isWorking: Math.random() > 0.3,
    isDayOff: Math.random() > 0.7
  }))

  const orders = [
    {
      id: '#482019',
      status: 'Paid',
      service: 'Document Delivery',
      client: 'Northbridge Group',
      address: '742 Elm St, Apt 12B',
      packageType: 'Legal Documents',
      deliverBy: '3:30 PM'
    },
    {
      id: '#234505',
      status: 'Not paid',
      service: 'Grocery Delivery',
      client: 'Emily Carter',
      address: '55 Lakeview Rd',
      packageType: 'Bouquet of flowers',
      deliverBy: '4:20 PM'
    },
    {
      id: '#873402',
      status: 'Paid',
      service: 'Pharmacy Delivery',
      client: 'Sarah Johnson',
      address: '889 Westfield Ave',
      packageType: 'Plastic bag',
      deliverBy: '5:30 PM'
    }
  ]

  const getStatusColor = (status: string) => {
    return status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const getDistanceColor = (category: string) => {
    switch (category) {
      case 'more than 200 km': return 'bg-lime-500'
      case 'more than 150 km': return 'bg-gray-300'
      case 'more than 100 km': return 'bg-black'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen">
      {/* Search Bar - Floating üstte */}
      <div className="sticky top-0 z-10 backdrop-blur-sm border-b border-gray-100/50 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-normal text-gray-900">Overview</h1>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-3 backdrop-blur-sm rounded-2xl border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Arnold Tanner</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">AT</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Earnings Card */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-red-600" />
              </div>
              <ArrowUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Earnings</h3>
                          <p className="text-2xl font-normal text-gray-900 mb-1">$1,287.01</p>
            <p className="text-sm text-green-600">$87 more than last month</p>
          </div>

          {/* Total Deliveries Card */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total deliveries</h3>
                          <p className="text-2xl font-normal text-gray-900 mb-1">37 orders</p>
            <p className="text-sm text-green-600">Your new record!</p>
          </div>

          {/* Avg Delivery Time Card */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowDown className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Avg delivery time</h3>
                          <p className="text-2xl font-normal text-gray-900 mb-1">22 min</p>
            <p className="text-sm text-green-600">10 min less than last week</p>
          </div>

          {/* Rating Card */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Your rating</h3>
                          <p className="text-2xl font-normal text-gray-900 mb-1">4.9</p>
            <p className="text-sm text-green-600">Your rating has increased!</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Total Distance Chart */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Total distance</h3>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 bg-gray-100 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="1 year">1 year</option>
                <option value="6 months">6 months</option>
                <option value="3 months">3 months</option>
              </select>
            </div>
            
            {/* Chart Bars */}
            <div className="flex items-end justify-between h-32 mb-4">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className={`w-8 rounded-t-lg ${getDistanceColor(data.category)}`}
                    style={{ height: `${(data.distance / 250) * 100}%` }}
                  ></div>
                  <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-lime-500 rounded"></div>
                <span className="text-gray-600">more than 200 km</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded"></div>
                <span className="text-gray-600">more than 150 km</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-black rounded"></div>
                <span className="text-gray-600">more than 100 km</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-white border border-gray-200 rounded"></div>
                <span className="text-gray-600">didn't work</span>
              </div>
            </div>
          </div>

          {/* Activity Calendar */}
          <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Activity for a month</h3>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                avg 5 in 7 days
              </Badge>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-xs text-gray-500 text-center mb-2">{day}</div>
              ))}
              
              {calendarData.map((day, index) => (
                <div key={index} className="flex flex-col items-center">
                  {day.isWorking ? (
                    <div className="w-6 h-6 bg-lime-500 rounded mb-1"></div>
                  ) : day.isDayOff ? (
                    <div className="w-6 h-6 bg-black rounded-full mb-1"></div>
                  ) : (
                    <div className="w-6 h-6 mb-1"></div>
                  )}
                  <span className="text-xs text-gray-400">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Orders for the day</h3>
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              See all
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order number</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Payment status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Service</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Package Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Deliver By</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.service}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.client}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.address}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.packageType}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.deliverBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
