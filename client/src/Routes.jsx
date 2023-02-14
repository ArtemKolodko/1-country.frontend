import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './routes/home/Home'
import { OpenWidgetsPage } from './routes/open-widgets/OpenWidgetsPage'
import WaitingRoom from './routes/waiting-room/WaitingRoom'
import { PageNotFound } from './routes/404/404Page'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="new/:domainName" element={<WaitingRoom />} />
      <Route path="home/" element={<OpenWidgetsPage />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

export default AppRoutes
