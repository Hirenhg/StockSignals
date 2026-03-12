import React from 'react'
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <>
    <Helmet>
      <title>404 | Page Not Found</title>
    </Helmet>
    <div className='notfound_page'>
      <div className='d-flex align-items-center justify-content-center min-vh-100'>
        <div className='bg-white rounded-2 text-center p-4 mw-sm-380'>
          <h1 className="mb-3 text-primary fw-semibold">404</h1>
          <p className="mb-3 text-primary">Page Not Found</p>
          <p className='f-size-14 text-gray-400 margin-b-30'>
            Sorry, the page you are looking for doesn’t exist or has been moved.
          </p>
          <button className='btn btn-primary w-100 rounded f-size-12 fw-medium d-flex align-items-center justify-content-center'
            onClick={() => navigate("/")}
          >
            Back To Home
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
