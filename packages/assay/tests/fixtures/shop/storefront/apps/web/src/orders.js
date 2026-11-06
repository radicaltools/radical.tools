const API = 'https://orders.example.com'
export const order = (id) => fetch(`${API}/api/orders/${id}`)
export const place = (body) => fetch('/api/orders', { method: 'POST', body })
export const logo = '/assets/logo.svg'
