import { useNavigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import React from 'react'

const NotFound: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Result
        status="404"
        title="页面没有找到"
        subTitle="对不起，您访问的页面不存在。"
        extra={
          <Button type="primary" onClick={() => navigate('/')} style={{ backgroundColor: 'blue'}}>
            回到首页
          </Button>
        }
      />
    </div>
  )
}

export default NotFound
