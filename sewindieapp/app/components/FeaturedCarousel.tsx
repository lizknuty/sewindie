'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination } from 'swiper/modules'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import styles from './FeaturedCarousel.module.css'

type FeaturedItem = {
  id: number
  name: string
  imageUrl: string
}

type FeaturedCarouselProps = {
  designers: FeaturedItem[]
  patterns: FeaturedItem[]
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ designers, patterns }) => {
  const swiperParams = {
    modules: [Navigation, Pagination],
    spaceBetween: 20,
    slidesPerView: 1,
    breakpoints: {
      640: {
        slidesPerView: 2,
      },
      768: {
        slidesPerView: 3,
      },
      1024: {
        slidesPerView: 4,
      },
    },
  }

  return (
    <div className={styles.carouselContainer}>
      <h2 className="text-3xl font-bold mb-6">Featured Designers</h2>
      <div className={styles.carouselWrapper}>
        <Swiper
          {...swiperParams}
          navigation={{
            nextEl: '.swiper-button-next-designers',
            prevEl: '.swiper-button-prev-designers',
          }}
          pagination={{ 
            clickable: true,
            el: '.swiper-pagination-designers',
          }}
        >
          {designers.map((designer) => (
            <SwiperSlide key={designer.id}>
              <Link href={`/designers/${designer.id}`}>
                <div className={styles.card}>
                  <div className={styles.imageContainer}>
                    <Image
                      src={designer.imageUrl}
                      alt={designer.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <div className={styles.content}>
                    <h3 className={styles.title}>{designer.name}</h3>
                  </div>
                </div>
              </Link>
            </SwiperSlide>
          ))}
          <div className="swiper-pagination-designers"></div>
        </Swiper>
        <div className={`swiper-button-prev-designers ${styles.swiperButtonPrev}`}>
          <ChevronLeft className="h-6 w-6" />
        </div>
        <div className={`swiper-button-next-designers ${styles.swiperButtonNext}`}>
          <ChevronRight className="h-6 w-6" />
        </div>
      </div>

      <h2 className="text-3xl font-bold mb-6 mt-12">Featured Patterns</h2>
      <div className={styles.carouselWrapper}>
        <Swiper
          {...swiperParams}
          navigation={{
            nextEl: '.swiper-button-next-patterns',
            prevEl: '.swiper-button-prev-patterns',
          }}
          pagination={{ 
            clickable: true,
            el: '.swiper-pagination-patterns',
          }}
        >
          {patterns.map((pattern) => (
            <SwiperSlide key={pattern.id}>
              <Link href={`/patterns/${pattern.id}`}>
                <div className={styles.card}>
                  <div className={styles.imageContainer}>
                    <Image
                      src={pattern.imageUrl}
                      alt={pattern.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <div className={styles.content}>
                    <h3 className={styles.title}>{pattern.name}</h3>
                  </div>
                </div>
              </Link>
            </SwiperSlide>
          ))}
          <div className="swiper-pagination-patterns"></div>
        </Swiper>
        <div className={`swiper-button-prev-patterns ${styles.swiperButtonPrev}`}>
          <ChevronLeft className="h-6 w-6" />
        </div>
        <div className={`swiper-button-next-patterns ${styles.swiperButtonNext}`}>
          <ChevronRight className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

export default FeaturedCarousel