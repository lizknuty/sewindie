import React from 'react';
import prisma from '../../lib/prisma'; // Adjust the path based on your Prisma setup
import Link from 'next/link';

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

const DesignersPage = ({ designers }) => {
  return (
    <div>
      <h1>Designers</h1>
      <div className="designer-grid">
        {designers.map((designer) => (
          <div key={designer.id} className="designer-card">
            <img src={designer.logo_url} alt={`${designer.name} logo`} className="designer-logo" />
            <h2>{designer.name}</h2>
            <p><strong>Address:</strong> {designer.address}</p>
            <p><strong>Email:</strong> <a href={`mailto:${designer.email}`}>{designer.email}</a></p>
            <p><strong>Website:</strong> <a href={designer.url} target="_blank" rel="noopener noreferrer">{designer.url}</a></p>
            <div className="social-links">
              {designer.facebook && <a href={designer.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}
              {designer.instagram && <a href={designer.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {designer.pinterest && <a href={designer.pinterest} target="_blank" rel="noopener noreferrer">Pinterest</a>}
              {designer.youtube && <a href={designer.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .designer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          padding: 20px;
        }
        .designer-card {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          text-align: center;
          background-color: #fff;
        }
        .designer-logo {
          width: 100px;
          height: auto;
          margin-bottom: 10px;
          border-radius: 8px;
        }
        .social-links a {
          display: inline-block;
          margin: 5px;
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

export default DesignersPage;
