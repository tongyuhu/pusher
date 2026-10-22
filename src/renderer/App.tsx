import { createHashRouter,RouterProvider,Link } from 'react-router-dom'
import { AppProvider } from './app/AppProvider'
import { AppShell } from './app/AppShell'
import { SettingsPage } from './settings/SettingsPage'
import { WorkbenchPage } from './workbench/WorkbenchPage'
const router=createHashRouter([{element:<AppShell/>,children:[{path:'/',element:<WorkbenchPage/>},{path:'/settings',element:<SettingsPage/>}]}])
export default function App(){return <AppProvider><RouterProvider router={router}/></AppProvider>}
