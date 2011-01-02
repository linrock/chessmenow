require 'sinatra'
require 'redis'
require 'haml'
require 'json'

use Rack::Session::Cookie,
  :key => 'session',
  :path => '/',
  :expire_after => 31536000,
  :secret => 'thisisanawesomesecretomgitssogood!!!11onelol'

redis = Redis.new


get '/' do
  session[:id] ||= Random.new.rand(1000000..9999999)
  haml :index
end

post '/' do
  session[:color] = params[:color]
  content_type :json
  {:color => session[:color]}.to_json
end
