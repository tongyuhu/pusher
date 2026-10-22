import { createHashRouter,RouterProvider,Link } from 'react-router-dom'
import { AppProvider } from './app/AppProvider'
import { AppShell } from './app/AppShell'
import { SettingsPage } from './settings/SettingsPage'
const router=createHashRouter([{element:<AppShell/>,children:[{path:'/',element:<main className="empty"><div className="brand-icon">↗</div><h1>Pusher</h1><p>配置推送凭据，即可开始测试。</p><Link to="/settings">打开设置 →</Link></main>},{path:'/settings',element:<SettingsPage/>}]}])
export default function App(){return <AppProvider><RouterProvider router={router}/></AppProvider>}
