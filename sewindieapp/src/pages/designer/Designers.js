import React from 'react';
import prisma from '../../lib/prisma'; // Ensure this path points to your Prisma client setup

export async function getServerSideProps() {
  const designers = await prisma.designer.findMany({
    select: {
      id: true,
      name: true,
      url: true,
      logo_url: true,
      email: true,
      address: true,
      facebook: true,
      instagram: true,
      pinterest: true,
      youtube: true,
    },
  });

  return {
    props: {
      designers,
    },
  };
}

const Designers = ({ designers }) => {
  return (
    <div className="container mt-5">
      {designers.map((designer) => (
        <div key={designer.id} className="row mb-4">
          <div className="col-md-4">
            <img src={designer.logo_url} alt={`${designer.name} logo`} className="img-fluid" />
          </div>
          <div className="col-md-8">
            <h2>{designer.name}</h2>
            <p><strong>Address:</strong> {designer.address}</p>
            <p><strong>Email:</strong> <a href={`mailto:${designer.email}`}>{designer.email}</a></p>
            <p><strong>Website:</strong> <a href={designer.url} target="_blank" rel="noopener noreferrer">Visit Website</a></p>
            <div className="social-links">
              {designer.facebook && (
                <a href={designer.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
              )}
              {designer.instagram && (
                <a href={designer.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
              )}
              {designer.pinterest && (
                <a href={designer.pinterest} target="_blank" rel="noopener noreferrer">Pinterest</a>
              )}
              {designer.youtube && (
                <a href={designer.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>
              )}
            </div>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        .social-links a {
          display: inline-block;
          margin-right: 10px;
          text-decoration: none;
          color: #0070f3;
        }
        .social-links a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default Designers;
