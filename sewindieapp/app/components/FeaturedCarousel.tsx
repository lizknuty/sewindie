'use client'

import React, { useRef } from 'react'
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
  console.log("[v0] FeaturedCarousel rendering with", designers.length, "designers and", patterns.length, "patterns")
  
  // Refs for navigation buttons
  const designersPrevRef = useRef<HTMLDivElement>(null)
  const designersNextRef = useRef<HTMLDivElement>(null)
  const patternsPrevRef = useRef<HTMLDivElement>(null)
  const patternsNextRef = useRef<HTMLDivElement>(null)
  
  const swiperParams = {
    modules: [Navigation, Pagination],
    spaceBetween: 20,
    slidesPerView: 1 as number | 'auto',
    observer: true,
    observeParents: true,
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
        <div ref={designersPrevRef} className={styles.swiperButtonPrev}>
          <ChevronLeft className="h-6 w-6" />
        </div>
        <div ref={designersNextRef} className={styles.swiperButtonNext}>
          <ChevronRight className="h-6 w-6" />
        </div>
        <Swiper
          {...swiperParams}
          navigation={{
            prevEl: designersPrevRef.current,
            nextEl: designersNextRef.current,
          }}
          onBeforeInit={(swiper) => {
            if (swiper.params.navigation && typeof swiper.params.navigation !== 'boolean') {
              swiper.params.navigation.prevEl = designersPrevRef.current
              swiper.params.navigation.nextEl = designersNextRef.current
            }
          }}
          pagination={{ 
            clickable: true,
          }}
          onSwiper={(swiper) => console.log("[v0] Designers Swiper initialized, slidesPerView:", swiper.params.slidesPerView)}
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
        </Swiper>
      </div>

      <h2 className="text-3xl font-bold mb-6 mt-12">Featured Patterns</h2>
      <div className={styles.carouselWrapper}>
        <div ref={patternsPrevRef} className={styles.swiperButtonPrev}>
          <ChevronLeft className="h-6 w-6" />
        </div>
        <div ref={patternsNextRef} className={styles.swiperButtonNext}>
          <ChevronRight className="h-6 w-6" />
        </div>
        <Swiper
          {...swiperParams}
          navigation={{
            prevEl: patternsPrevRef.current,
            nextEl: patternsNextRef.current,
          }}
          onBeforeInit={(swiper) => {
            if (swiper.params.navigation && typeof swiper.params.navigation !== 'boolean') {
              swiper.params.navigation.prevEl = patternsPrevRef.current
              swiper.params.navigation.nextEl = patternsNextRef.current
            }
          }}
          pagination={{ 
            clickable: true,
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
        </Swiper>
      </div>
    </div>
  )
}

export default FeaturedCarousel
