import api from './index'

export const searchUsers = (q: string) => api.get(`/social/search?q=${encodeURIComponent(q)}`)
export const followUser = (userId: string) => api.post('/social/follow', { userId })
export const unfollowUser = (userId: string) => api.delete(`/social/follow/${userId}`)
export const getFollowing = () => api.get('/social/following')
export const getFollowingFeed = () => api.get('/social/feed')
export const getPublicBooks = () => api.get('/public/books')
export const toggleBookVisibility = (bookId: string) => api.patch(`/books/${bookId}/visibility`)
