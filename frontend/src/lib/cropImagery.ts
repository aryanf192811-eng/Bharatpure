/**
 * Curated agricultural photography, sourced from design/evolved/ (the Stitch-generated design
 * reference already committed to this repo). Verified live before use -- the "aida-public/*"
 * asset path is publicly servable; the "aida/*" path (used for the brand emblem specifically)
 * returns 403 and is NOT usable here, so the emblem stays a Lucide icon instead of a photo.
 *
 * Reused across listing cards, product detail, and role-specific hero banners so the app reads
 * as agriculture-rooted (Green/White Revolution palette: deep forest green + harvest gold) rather
 * than a generic flat-color SaaS dashboard.
 */

const CROP_PHOTOS: Record<string, string[]> = {
  TURMERIC: [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDiWFksq3xVl1Myv9bvfhInbu_2d1KDAEGLPePthWEOESa03UBKkqfPHCWQFcrxwMcksBMA_LqiOEPf5iFrWGaGzvwwycKsPzF01gYYAsxMuYB8HSNZSBqhhusnaFvyrAJ-CXA9pkssdG2A9dB0QsCxw-QPMh3Nwq3CCJQvPQ0suJ3d-1YJ5YgMTWp1mM_NCIviXdGKE1ShvbqhlVCP-RQKuzSZ0BiU2wQkrE0Y-Rb6tkrj0XwbStKd',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCW0om94b-3VAFfEURY4yXnHSgd4tIW-QYmuQMw9Wm-LITkRuyW902PUDwdNgZ1V31GIUMPQYqhsH8djX05e44uWP6ufPeVwsyPVKPCxzsO-mOc07Nn0ABietMGHNyXLFWenx2ZXTKtkiLRVUpK5uFKx7JbC9q6rHQ_B62yIWvfPISHg7Zcj8p_Ehhvsnt6y121BLujePPmr-ZC0GQ8L0fcxk5jLTkXzlSUq5eA0HV-fox19-iB-HrN',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDZrWdIKhUKPoQtuwJ3IwI-LWl2vx1AxCC2pUeY3mhgvgoYom75zg9-FUxOHG8yn7c6adtTRhuS4HmeJQ4fZ3eEPmMyZAeaiTnpVCbsvQ-HScjb4WYvR_5RgROlvcASe3YuQipZPftcsvI7jCUaZUVtSGuUUmS1dUDH5_elw3ZUMUqL0XOpsRUo433mu8kQM7WXZtocLBbFZIHm2cHz4vCX9Pda0pSETvIZizPeqwPiDFXjeB2uECHa',
  ],
  MUSTARD: [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBCDUEd0c4mDDEjcaMDQE7M9EgywbXE0IjR6QlpV9QoU5BtuBnkGDrEVP8f8OPt8CyrPENcBGF-8GdsYcyk6NiLNVPdY80a390B4DpHMcX5LXwVUzqUJRS5e0sI31WoP4-NppxhgOaKwR-nQ57zswc8qjxF7_zLSupSAKE61-T_HhPgUadmRCmwnJLKZqiOJhCVdbzc0redDWuvPf7Qcr63-BsC4NcVLlnvbV9yeNplCfkTfJrLURss',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYGbKC6MK0SQdlvHZiSEvLmUfEtg-a7HXci2cCuf4P6Ecv9wcuPKChq6tuQ2D4cC1YGnd-D9PgtQlTOUwfUlX040IhMCF7tMOj-L-h2CQl80OHi56nO1RuquIJnZdQKBCIp12H9F_IV_1XzaoN2bpBQ_9vX5fqhTq1l_hBl7lNUce85YkCkQ3HgPbTYs8yTEPNKWoIFkbj6fMa7SG2YZH-vOFKS_DwUAIMQvYhrmhSwnG7j1zn3uCG',
  ],
  HONEY: [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD23sz9bm4ivaxnIXLHf6tiC_e-hsF7B9zDQN1ZLGXAVxW-FUI4PePV9pz0o2gBAhDQsRD6O8n9P88taGNaNaV_anICOU2evFgQatQh2jPbjNKnWfstBEdMr6facXDNrdFur9MapNzbSz7nOvHWdv1ECB00JQZcizdR9As4pWzubLLBozAYWR6I9wHtFgn74M3NHB8bNexftq7QPGE8rPgzEtuFTh0urId87_6aDEBfXgAJdPF0aKG7',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC36TEZQS2W7vPmpa_D__SGgAQ7vSy8WoxEtDkEPRxndy2atxohYKMBJq5EyCkJ6peMsL_mAr5yV6XXvLAEopJrwh0sYQel2H2QUEymTwHokODx1qzsdbhqHs2WqNrU7gSdBw58C6fJUBKxyiPr0zrvqey7j1_10gQwGIF3jo-VPfGuV2QYROfFYNnPMJQbc383xZQRK4anzTikfImNC7zqC1DXSlvE5rd73_7UstDjxCDEiHaOyzXn',
  ],
  WHEAT: [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBxRSKHfw7yeub3qDnvLu3Rzej0814wi7S2ncBhkUR2VAy05nkpYMnmIO5Y0WXRun-Y7JhLGcA3te1Rrqkdoo4JRLYrE572tPEy7Yx2DKBrijHWf4YlbNtyckJJ4NW-dGgKTosKeSX7EWPcdHzRh19naIB9UWjbbuVpZu6uq9F_EvpYDKZpdrtQybvwQrO6b4aj3YWZTSe3RiMchIQ7pQoM8oMtNnjQ9XMPpcOodfKIM32BicFOI_5K',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBNtIAXkmBQ6dqBbrlIhYBKnTFROUHkvP6rAhCK7XacG3u864xEVbtgfFolQD29dKODiFgqOgYEfsOMemZ4uzOv2bG8zDfzDlfqRL5xD2w1N3n-6upDc3cunaM5kl768FUSlz-oJ6VbyPpua1oACEebgv05lJ1ZZmBUduQaVE7Xd6uM2ivdMAf77nWQknN0cAuCTcyBluu45X4YQrO5HKXMwZPwWgETN7R9NtwvoP7osp3lYEow3WI0',
  ],
}

const FALLBACK_CROP_PHOTO = CROP_PHOTOS.WHEAT[0]

/** Deterministic (not random) pick so the same batch/listing always renders the same photo. */
export function getCropPhoto(cropType: string | undefined, seed = 0): string {
  const photos = (cropType && CROP_PHOTOS[cropType.toUpperCase()]) || [FALLBACK_CROP_PHOTO]
  return photos[seed % photos.length]
}

export const HERO_IMAGES = {
  /**
   * Real Indian farmer working a green paddy field (Unsplash, free-to-use license). Replaced the
   * original Stitch-placeholder here -- that one turned out to be a stock "smart farm dashboard"
   * mockup photo with UI-overlay graphics baked into the image itself, not a clean field shot, and
   * looked visibly wrong under the AuthLayout/Landing gradient. Verified by loading it directly at
   * 2400px before wiring in.
   */
  turmericField: 'https://images.unsplash.com/photo-1770892123242-c876a0a343f5?q=80&w=2400&auto=format&fit=crop',
  farmerPortrait:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC2-eu-_ZRnRxeCOUj4kSYzvzxKDOVZY9xhXlDkvfIHqzJc2scH7i9qze59nh0fzm3sP21cq0Ul-JxEJp4XH2gGucSS37c0Sr_wLH-1jmwnOvl61OshlxuT-ulIolsYol3saFP7aaIqxoj-ahP-wAxOwDUDVUBlwWBL9lKvDoUgA1OSOVcsuiy1QB1w9v4ihczD9_GP_9Q36BXlHhzcNtQb-qIGDQAms79TJBQCJ9Gl2Mf72Vu7Sc4q',
  driverPortrait:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCsFPEllI85yHSYbGmPy-5eorzZ_9QRqU51TSXTRlAyXBhF1FNchkBMRQ_dOBtYbM7NcYPVLFn7LdHgsv2iOAaKNodZcwdqTqqUzz-yQmlO4h25_-RGWkgIrAkfLuOtg9sII0RyjQHuXrQ9DzzI7pPliqLOTqPC0IwjnTfUaH86BG9ivTzxNaT2RpU7jSHn1iXd3GkvqHuURgkYaxmm_hsmwYRixZpxnu3ITSEVVVSaIO7Kjf0b_zXS',
  labScene:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCM0vAXPZkETR9BmbVvjZJfTPr5gcqvE4pJUtI5_WpBwyH7AVfLEjdnkatI9it2szFHsv9z2JaY6UBS5zrJGBKjyq21MqGvK-friBZ_IOWujuK7G3PGpNmn2qTHK8h0yEjFjzmZNcoIKQb6pZk-50j3izKlMF10pRWWlRxXEzI5dZTex_4eZCJUdIt0uMxD7RjpMs8VBYnrtxiHPiXeb2nJX_3mAy-ThtrYDE9DTc4fpHpp27qqlwlt',
  warehouseScene:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBKYiaAwv9z8o6NXqrEH3wY1s1CK3vmmHO8v9e7sAjHso3OdypoN0ZPmyhtzvjfO8MWzQx3x0apobvN8zvUP_A4deFg4-MEOWp6SrJFZNJJA6dbqkUKwDOB9IpDSAKe-A9C4buQ1dL76bAimvDctkpPnHqi-LcucAUnMTFuW6xS3-ieoAHM4TDbC2DbvcskDeMRzlME6lpbrL3PJ60THOTGoJPUhdRi6QkvT4_ApXYwt4Ra3n7k21W5',
} as const
