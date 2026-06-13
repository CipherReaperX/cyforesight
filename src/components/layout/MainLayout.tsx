import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0b1220]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_8%_10%,rgba(6,182,212,0.08),transparent_35%),radial-gradient(circle_at_92%_2%,rgba(249,115,22,0.08),transparent_30%)] p-6 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
