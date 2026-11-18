import React from 'react'
import { navigate, type RouteName } from '../router'

const ITEMS: { name: RouteName; label: string }[] = [
  { name: 'watch', label: '链接播放' },
  { name: 'community', label: '社区' },
  { name: 'local', label: '本地视频' },
  { name: 'pricing', label: '会员' }
]

const NavBar: React.FC<{ current: RouteName }> = ({ current }) => (
  <nav className="navbar" data-tour="nav">
    <span className="navbar-brand">LanguageMaster</span>
    {ITEMS.map((item) => (
      <button
        key={item.name}
        className={`navbar-item ${current === item.name ? 'active' : ''}`}
        data-tour={`nav-${item.name}`}
        onClick={() => navigate(item.name)}
      >
        {item.label}
      </button>
    ))}
    <div className="navbar-spacer" />
    {/* Right-side slot: usage meter (billing) and settings button go here */}
    <div className="navbar-right" id="navbar-right" />
  </nav>
)

export default NavBar
